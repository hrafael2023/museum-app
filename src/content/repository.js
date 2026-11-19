// Fonte única do conteúdo da exposição (data/exhibition.json).
// A ordem dos itens define o índice de cada alvo no arquivo targets.mind.
let exhibition = null;

export async function loadExhibition(url = 'data/exhibition.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar ${url}`);
  exhibition = await res.json();
  exhibition.items.forEach((item, index) => { item.targetIndex = index; });
  return exhibition;
}

export function getExhibition() {
  return exhibition;
}

export function getItems() {
  return exhibition?.items ?? [];
}

export function getItem(id) {
  return getItems().find((item) => item.id === id) ?? null;
}

export function getItemByTarget(index) {
  return getItems()[index] ?? null;
}

// Texto narrado pelo audioguia quando o item não tem um áudio gravado.
export function narrationText(item) {
  if (item.audio?.script) return item.audio.script;
  const parts = [item.title, item.subtitle, item.dates, item.summary];
  for (const section of item.sections ?? []) {
    if (section.heading) parts.push(section.heading);
    parts.push(...section.paragraphs);
  }
  return parts.filter(Boolean).join('. ').replace(/\.\s*\./g, '.');
}
