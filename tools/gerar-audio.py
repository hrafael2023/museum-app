#!/usr/bin/env python3
"""Gera as narrações do audioguia com uma voz do Gemini (texto para fala).

Para cada item de data/exhibition.json, monta o mesmo texto que o app lê
(item.audio.script, ou título, subtítulo, datas, resumo e seções), pede o
áudio ao Gemini e salva assets/audio/<id>.mp3. Depois preenche
"audio": {"src": ...} no item, e o app passa a tocar o arquivo no lugar da voz
do aparelho.

A chave da API fica fora do projeto: na variável GEMINI_API_KEY ou no arquivo
~/.config/museum-app/gemini_api_key. Ela é usada só aqui, nunca vai para o app.

Uso:
  python3 tools/gerar-audio.py                  gera o que mudou
  python3 tools/gerar-audio.py --forcar         gera tudo de novo
  python3 tools/gerar-audio.py --itens roda-dos-bichos,mira-schendel
  python3 tools/gerar-audio.py --amostras DIR   uma frase em várias vozes, para comparar

Voz e estilo: "narration": {"voice": ..., "style": ...} no exhibition.json.
Cada trecho gerado é transcrito e comparado com o texto; se não bater, é
gerado de novo. Precisa do ffmpeg (brew install ffmpeg) para gravar o mp3.
"""
import argparse
import base64
import difflib
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "exhibition.json"
OUT = ROOT / "assets" / "audio"
MANIFEST = OUT / "manifest.json"

MODEL = "gemini-3.8-flash-tts"            # o "-lite-tts" tem cota própria, se esta acabar
CHECK_MODEL = "gemini-3.5-flash-lite"     # transcreve o áudio para conferir com o texto
VOICE = "Sulafat"
# Instrução de estilo antes do texto. Em inglês e pedindo leitura literal: em
# testes, instruções em português às vezes eram lidas em voz alta, e pedir que
# a voz "converse como mediadora" fez uma delas inventar frases.
STYLE = (
    "Read the following Brazilian Portuguese text aloud verbatim, in a warm, "
    "natural, welcoming museum audio guide voice:"
)
SAMPLE_VOICES = ["Sulafat", "Achernar", "Vindemiatrix", "Aoede", "Kore", "Gacrux", "Charon", "Iapetus"]
RATE = 24000          # o Gemini devolve PCM 16 bits, mono, 24 kHz
CHUNK = 2400          # caracteres por pedido (textos longos vão em partes)
PAUSE = 0.45          # silêncio entre as partes, em segundos
MIN_MATCH = 0.85      # semelhança mínima entre o texto e a transcrição do áudio


def api_key():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        f = pathlib.Path.home() / ".config" / "museum-app" / "gemini_api_key"
        if f.exists():
            key = f.read_text().strip()
    if not key:
        sys.exit("Sem chave: defina GEMINI_API_KEY ou crie ~/.config/museum-app/gemini_api_key.")
    return key


def narration_text(item):
    """O mesmo texto de narrationText() em src/content/repository.js."""
    if (item.get("audio") or {}).get("script"):
        return item["audio"]["script"]
    parts = [item.get("title"), item.get("subtitle"), item.get("dates"), item.get("summary")]
    for section in item.get("sections") or []:
        if section.get("heading"):
            parts.append(section["heading"])
        parts.extend(section["paragraphs"])
    text = ". ".join(p for p in parts if p)
    return re.sub(r"\.\s*\.", ".", text)


def split(text, size=CHUNK):
    """Divide em partes de até `size` caracteres, sem cortar frases."""
    sentences = re.findall(r"[^.!?…]+[.!?…]*[\"”]?\s*", text) or [text]
    chunks, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) > size:
            chunks.append(cur.strip())
            cur = ""
        cur += s
    if cur.strip():
        chunks.append(cur.strip())
    return chunks


def call(model, body, key, timeout=180):
    """Chama generateContent, com novas tentativas em erros passageiros."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)["candidates"][0]["content"]["parts"][0]
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code == 429 and "per day" in msg:
                sys.exit(f"A cota diária do modelo {model} acabou. Tente amanhã, use outro "
                         "modelo (--modelo) ou ative o faturamento da chave no Google AI Studio.")
            if e.code in (429, 500, 502, 503, 504) and attempt < 6:
                wait = min(2 ** attempt * 5, 90)
                print(f"    erro {e.code}, tentando de novo em {wait}s…", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"Erro {e.code} da API do Gemini: {msg[:400]}")
        except (KeyError, IndexError, TimeoutError, OSError) as e:
            if attempt < 6:
                print(f"    {type(e).__name__}, tentando de novo…", flush=True)
                time.sleep(10)
                continue
            sys.exit(f"Falha ao chamar {model}: {e}")


def synthesize(text, voice, style, model, key):
    part = call(model, {
        "contents": [{"parts": [{"text": f"{style}\n\n{text}" if style else text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }, key)
    return base64.b64decode(part["inlineData"]["data"])


def words(text):
    return re.findall(r"\w+", text.lower())


def check(pcm, text, key):
    """Transcreve o áudio e mede quanto ele bate com o texto (0 a 1).

    Protege contra a voz pular trechos, ler a instrução ou inventar frases."""
    mp3 = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1",
         "-i", "-", "-codec:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "-"],
        input=pcm, check=True, capture_output=True).stdout
    part = call(CHECK_MODEL, {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/mpeg", "data": base64.b64encode(mp3).decode()}},
        {"text": "Transcreva exatamente este áudio, palavra por palavra, sem comentários."},
    ]}]}, key)
    heard, said = words(part["text"]), words(text)
    return difflib.SequenceMatcher(None, said, heard, autojunk=False).ratio()


def narrate(text, voice, style, model, key):
    """Gera um trecho e confere; refaz até 3 vezes se o áudio não bater com o texto."""
    for attempt in range(3):
        pcm = synthesize(text, voice, style, model, key)
        score = check(pcm, text, key)
        if score >= MIN_MATCH:
            return pcm, score
        print(f"    o áudio não bate com o texto ({score:.0%}), gerando de novo…", flush=True)
    sys.exit("O áudio continuou diferente do texto depois de 3 tentativas. Nada foi salvo deste item.")


def to_mp3(pcm, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1",
         "-i", "-", "-codec:a", "libmp3lame", "-b:a", "64k", str(path)],
        input=pcm, check=True,
    )


def fingerprint(text, voice, style, model):
    return hashlib.sha256(f"{model}|{voice}|{style}|{text}".encode()).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--itens", help="ids separados por vírgula (padrão: todos)")
    ap.add_argument("--forcar", action="store_true", help="gera de novo mesmo sem mudança")
    ap.add_argument("--voz", help="nome da voz (sobrepõe o exhibition.json)")
    ap.add_argument("--modelo", default=MODEL)
    ap.add_argument("--amostras", metavar="DIR", help="gera uma frase em várias vozes nesta pasta")
    args = ap.parse_args()

    key = api_key()
    ex = json.loads(DATA.read_text())
    conf = ex.get("narration") or {}
    voice = args.voz or conf.get("voice") or VOICE
    style = conf.get("style") or STYLE

    if args.amostras:
        item = ex["items"][0]
        text = " ".join(split(narration_text(item), 320)[:1])
        out = pathlib.Path(args.amostras)
        for v in SAMPLE_VOICES:
            print(f"amostra {v}…", flush=True)
            to_mp3(narrate(text, v, style, args.modelo, key)[0], out / f"{v}.mp3")
        print(f"Amostras em {out}")
        return

    wanted = set(args.itens.split(",")) if args.itens else None
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    silence = b"\x00\x00" * int(RATE * PAUSE)

    def save():
        # Salva a cada item: se a cota acabar no meio, o que já foi gerado fica registrado.
        OUT.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        DATA.write_text(json.dumps(ex, indent=2, ensure_ascii=False) + "\n")

    for item in ex["items"]:
        if wanted and item["id"] not in wanted:
            continue
        text = narration_text(item)
        fp = fingerprint(text, voice, style, args.modelo)
        dest = OUT / f"{item['id']}.mp3"
        src = f"assets/audio/{item['id']}.mp3"
        if not args.forcar and manifest.get(item["id"]) == fp and dest.exists():
            print(f"{item['id']}: sem mudança")
        else:
            chunks = split(text)
            print(f"{item['id']}: {len(text)} caracteres em {len(chunks)} parte(s), voz {voice}", flush=True)
            pcm = b""
            for i, chunk in enumerate(chunks, 1):
                print(f"  parte {i}/{len(chunks)}", flush=True)
                part, score = narrate(chunk, voice, style, args.modelo, key)
                print(f"    conferido: {score:.0%} igual ao texto", flush=True)
                pcm += (silence if pcm else b"") + part
            to_mp3(pcm, dest)
            manifest[item["id"]] = fp
            print(f"  {dest.relative_to(ROOT)}: {len(pcm) / 2 / RATE:.0f}s, {dest.stat().st_size / 1e6:.1f} MB")
        item.setdefault("audio", {})["src"] = src
        save()


if __name__ == "__main__":
    main()
