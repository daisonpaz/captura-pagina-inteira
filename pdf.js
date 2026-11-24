// Gerador de PDF minimalista: cada página recebe uma imagem JPEG.
// Sem bibliotecas externas.
function buildPdf(pages, title) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let pos = 0;

  const push = (d) => {
    if (typeof d === 'string') d = enc.encode(d);
    chunks.push(d);
    pos += d.length;
  };
  const begin = (n) => { offsets[n] = pos; push(`${n} 0 obj\n`); };
  const f = (n) => (Math.round(n * 100) / 100).toString();

  // Texto em UTF-16BE para acentos no título
  const pdfText = (s) => {
    let hex = 'FEFF';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c > 0xffff) {
        const v = c - 0x10000;
        hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0');
        hex += (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
      } else {
        hex += c.toString(16).padStart(4, '0');
      }
    }
    return `<${hex.toUpperCase()}>`;
  };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + comentário binário

  const n = pages.length;
  const infoId = 3 + n * 3;
  const pageId = (i) => 3 + i * 3;

  begin(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  begin(2);
  push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pid = pageId(i);
    const cid = pid + 1;
    const iid = pid + 2;

    begin(pid);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(p.pageW)} ${f(p.pageH)}] ` +
         `/Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>\nendobj\n`);

    const content = enc.encode(`q ${f(p.w)} 0 0 ${f(p.h)} ${f(p.x)} ${f(p.y)} cm /Im0 Do Q\n`);
    begin(cid);
    push(`<< /Length ${content.length} >>\nstream\n`);
    push(content);
    push('endstream\nendobj\n');

    begin(iid);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.imgW} /Height ${p.imgH} ` +
         `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push('\nendstream\nendobj\n');
  });

  begin(infoId);
  push(`<< /Title ${pdfText(title || 'Captura')} /Producer (Captura Pagina Inteira) >>\nendobj\n`);

  const xref = pos;
  const size = infoId + 1;
  let x = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(x);
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

if (typeof module !== 'undefined') module.exports = { buildPdf };
