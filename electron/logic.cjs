'use strict';

// Pure, deterministic helpers; kept separate so CI can test recommendation logic.
const CATALOG = Object.freeze([
  { id: 'qwen2.5:3b', name: 'Qwen 2.5 · 3B', gb: 2.0, description: 'Fast, compact, general-purpose chat', tags: ['Fast', 'General'], context: 'Lightweight' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 · 3B', gb: 2.1, description: 'Small and responsive everyday assistant', tags: ['Fast', 'Chat'], context: 'Lightweight' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 · 7B', gb: 4.7, description: 'An excellent balance of quality and speed', tags: ['Balanced', 'Coding'], context: 'Midrange' },
  { id: 'gemma3:12b', name: 'Gemma 3 · 12B', gb: 8.1, description: 'More capable; benefits from generous VRAM', tags: ['Advanced', 'Reasoning'], context: 'High-end' },
  { id: 'qwen2.5:14b', name: 'Qwen 2.5 · 14B', gb: 9.0, description: 'Strong responses with higher memory needs', tags: ['Advanced', 'Coding'], context: 'High-end' },
]);

const gb = bytes => +(Math.max(0, Number(bytes) || 0) / (1024 ** 3)).toFixed(1);

function recommendations(hardware) {
  const ram = hardware?.ramTotalGb || 0;
  const vram = hardware?.vramGb || 0;
  return CATALOG.map(model => {
    // Ollama model file sizes are indicative; OS + KV cache + runtime need headroom.
    const required = model.gb * 1.45;
    const fitsRam = ram >= required + 3;
    const fitsGpu = vram > 0 && vram >= required;
    const fitsHybrid = fitsRam && vram >= model.gb * 0.4;
    const tier = !fitsRam ? 'limited' : fitsGpu ? 'excellent' : fitsHybrid ? 'good' : 'cpu';
    const fit = !fitsRam ? Math.max(5,Math.round(17-model.gb)) : fitsGpu ? Math.min(99,Math.round(84+model.gb*1.2)) : fitsHybrid ? Math.round(78-model.gb) : Math.max(20,Math.round(54-model.gb*2));
    return { ...model, fit, tier, note: tier === 'limited'
      ? 'May exceed available memory'
      : tier === 'excellent' ? 'Estimated to fit in GPU memory'
      : tier === 'good' ? 'Likely hybrid GPU/CPU inference'
      : 'Likely CPU inference; speed may be reduced' };
  }).sort((a, b) => b.fit - a.fit || b.gb - a.gb);
}

function displaySafeError(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

module.exports = { CATALOG, gb, recommendations, displaySafeError };
