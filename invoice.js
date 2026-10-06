const form = document.getElementById('invoiceForm');
const itemsContainer = document.getElementById('itemsContainer');
const itemTemplate = document.getElementById('itemTemplate');
const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const draftKey = 'mosnetBusinessDocumentDraftV2';
const legacyDraftKey = 'mosnetInvoiceDraftV1';
const invoiceCounterKey = 'mosnetInvoiceCounterV2';
const quotationCounterKey = 'mosnetQuotationCounterV2';

function localISODate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function nextDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

function getDocumentType() {
  return document.querySelector('input[name="documentType"]:checked')?.value || 'quotation';
}

function counterKeyFor(type) {
  return type === 'invoice' ? invoiceCounterKey : quotationCounterKey;
}

function currentCounter(type = getDocumentType()) {
  return Math.max(1, Number(localStorage.getItem(counterKeyFor(type)) || 1));
}

function documentNumberFromCounter(type, counter) {
  const prefix = type === 'invoice' ? 'INV' : 'QUO';
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}

function normalizeService(service) {
  if (['Building', 'Bricklaying', 'Plastering'].includes(service)) return 'Building & Plastering';
  return service || 'Building & Plastering';
}

function autoGrow(el) {
  if (!el || el.tagName !== 'TEXTAREA') return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 52)}px`;
}

function refreshAutoGrow() {
  document.querySelectorAll('textarea.auto-grow').forEach(autoGrow);
}

function updateDocumentUI({ resetNumber = false, resetDates = false } = {}) {
  const type = getDocumentType();
  const isInvoice = type === 'invoice';
  const typeTitle = isInvoice ? 'Invoice' : 'Quotation';
  const number = document.getElementById('invoiceNumber');

  document.getElementById('detailsHeading').textContent = `${typeTitle} details`;
  document.getElementById('detailsHelp').textContent = `Keep a different ${typeTitle.toLowerCase()} number for each ${typeTitle.toLowerCase()}.`;
  document.getElementById('numberLabel').textContent = `${typeTitle} number`;
  document.getElementById('dateLabel').textContent = `${typeTitle} date`;
  document.getElementById('secondDateLabel').textContent = isInvoice ? 'Due date' : 'Valid until';
  document.getElementById('clientHelp').textContent = `These details will appear under “${isInvoice ? 'Bill To' : 'Quote For'}” on the PDF.`;
  document.getElementById('notesLabel').textContent = `${typeTitle} notes / terms`;
  document.getElementById('actionCopy').textContent = `Generate a branded MOSNET GROUP PDF ${typeTitle.toLowerCase()}.`;
  document.getElementById('newInvoiceBtn').textContent = `New ${typeTitle.toLowerCase()}`;
  document.getElementById('downloadBtn').textContent = `Download ${typeTitle} PDF`;

  if (resetNumber || !number.value || /^(INV|QUO)-\d+$/i.test(number.value)) {
    number.value = documentNumberFromCounter(type, currentCounter(type));
  }
  if (resetDates) {
    document.getElementById('invoiceDate').value = localISODate();
    document.getElementById('dueDate').value = nextDate(isInvoice ? 7 : 14);
  }
}

function addItem(data = {}) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.item-service').value = normalizeService(data.service);
  row.querySelector('.item-description').value = data.description || '';
  row.querySelector('.item-qty').value = data.qty ?? 1;
  row.querySelector('.item-price').value = data.price ?? '';

  row.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      calculateTotals();
      saveDraft();
    });
    el.addEventListener('change', () => {
      calculateTotals();
      saveDraft();
    });
  });

  row.querySelector('.remove-item').addEventListener('click', () => {
    if (itemsContainer.children.length === 1) {
      row.querySelector('.item-description').value = '';
      row.querySelector('.item-qty').value = 1;
      row.querySelector('.item-price').value = '';
      autoGrow(row.querySelector('.item-description'));
    } else {
      row.remove();
    }
    calculateTotals();
    saveDraft();
  });

  itemsContainer.appendChild(row);
  autoGrow(row.querySelector('.item-description'));
  calculateTotals();
}

function readItems() {
  return [...itemsContainer.querySelectorAll('.item-row')].map(row => ({
    service: row.querySelector('.item-service').value,
    description: row.querySelector('.item-description').value.trim(),
    qty: Number(row.querySelector('.item-qty').value || 0),
    price: Number(row.querySelector('.item-price').value || 0),
  })).map(item => ({ ...item, total: item.qty * item.price }));
}

function calculateTotals() {
  const items = readItems();
  [...itemsContainer.querySelectorAll('.item-row')].forEach((row, index) => {
    row.querySelector('.item-total strong').textContent = currency.format(items[index].total || 0);
  });
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const vatPercent = Number(document.getElementById('vatPercent').value || 0);
  const vatAmount = subtotal * (vatPercent / 100);
  const total = subtotal + vatAmount;
  document.getElementById('subtotalDisplay').textContent = currency.format(subtotal);
  document.getElementById('vatDisplay').textContent = currency.format(vatAmount);
  document.getElementById('totalDisplay').textContent = currency.format(total);
  return { subtotal, vatPercent, vatAmount, total };
}

function formData() {
  return {
    documentType: getDocumentType(),
    invoiceNumber: document.getElementById('invoiceNumber').value.trim(),
    reference: document.getElementById('reference').value.trim(),
    invoiceDate: document.getElementById('invoiceDate').value,
    dueDate: document.getElementById('dueDate').value,
    clientName: document.getElementById('clientName').value.trim(),
    clientContact: document.getElementById('clientContact').value.trim(),
    clientContactInfo: document.getElementById('clientContactInfo').value.trim(),
    clientAddress: document.getElementById('clientAddress').value.trim(),
    scopeOfWork: document.getElementById('scopeOfWork').value.trim(),
    materials: document.getElementById('materials').value.trim(),
    notes: document.getElementById('notes').value.trim(),
    vatPercent: Number(document.getElementById('vatPercent').value || 0),
    items: readItems(),
    totals: calculateTotals()
  };
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(formData()));
  } catch (_) {}
}

function loadDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (!draft) draft = JSON.parse(localStorage.getItem(legacyDraftKey) || 'null');
  } catch (_) {}

  const type = draft?.documentType || 'quotation';
  const radio = document.querySelector(`input[name="documentType"][value="${type}"]`);
  if (radio) radio.checked = true;

  document.getElementById('invoiceNumber').value = draft?.invoiceNumber || documentNumberFromCounter(type, currentCounter(type));
  document.getElementById('reference').value = draft?.reference || '';
  document.getElementById('invoiceDate').value = draft?.invoiceDate || localISODate();
  document.getElementById('dueDate').value = draft?.dueDate || nextDate(type === 'invoice' ? 7 : 14);
  document.getElementById('clientName').value = draft?.clientName || '';
  document.getElementById('clientContact').value = draft?.clientContact || '';
  document.getElementById('clientContactInfo').value = draft?.clientContactInfo || '';
  document.getElementById('clientAddress').value = draft?.clientAddress || '';
  document.getElementById('scopeOfWork').value = draft?.scopeOfWork || '';
  document.getElementById('materials').value = draft?.materials || '';
  document.getElementById('notes').value = draft?.notes || '';
  document.getElementById('vatPercent').value = Number.isFinite(draft?.vatPercent) ? draft.vatPercent : 0;

  itemsContainer.innerHTML = '';
  const items = draft?.items?.length ? draft.items : [
    { service: 'Building & Plastering', description: '', qty: 1, price: '' }
  ];
  items.forEach(addItem);
  updateDocumentUI();
  calculateTotals();
  requestAnimationFrame(refreshAutoGrow);
}

function validateDocument() {
  if (!form.reportValidity()) return false;
  const type = getDocumentType();
  const label = type === 'invoice' ? 'invoice' : 'quotation';
  const items = readItems().filter(item => item.description || item.price > 0);
  if (!items.length || items.every(item => item.price <= 0)) {
    alert(`Add at least one construction service with a price before generating the ${label}.`);
    return false;
  }
  return true;
}

function formatDateForPDF(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function money(value) {
  return `R ${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function logoAsDataURL() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = 'assets/mosnet-logo.png';
  });
}

async function buildPDF() {
  if (!window.jspdf?.jsPDF) {
    throw new Error('PDF library could not load. Please check your internet connection and try again.');
  }
  if (!validateDocument()) return null;

  const data = formData();
  const isInvoice = data.documentType === 'invoice';
  const documentTitle = isInvoice ? 'INVOICE' : 'QUOTATION';
  const documentLabel = isInvoice ? 'Invoice' : 'Quotation';
  const items = data.items.filter(item => item.description || item.price > 0);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageW = 210;
  const margin = 15;
  const navy = [11, 44, 99];
  const blue = [18, 62, 138];
  const gold = [214, 176, 74];
  const grey = [95, 105, 120];
  const line = [218, 225, 235];
  const logo = await logoAsDataURL();

  function drawHeader() {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 42, 'F');
    doc.setFillColor(...gold);
    doc.rect(0, 42, pageW, 3, 'F');
    if (logo) {
      try { doc.addImage(logo, 'PNG', 15, 7, 27, 27); } catch (_) {}
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('MOSNET GROUP PTY LTD', 48, 16);
    doc.setFontSize(10);
    doc.text('CONSTRUCTION SERVICES', 48, 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('073 162 1954  •  mosnetgroup@gmail.com', 48, 30);
    doc.text('www.mosnetgroupprojects.co.za  •  Nationwide', 48, 35);
  }

  function ensureSpace(required, resetY = 55) {
    if (y + required > 278) {
      doc.addPage();
      drawHeader();
      y = resetY;
      return true;
    }
    return false;
  }

  function drawTextSection(title, body) {
    if (!body) return;
    const lines = doc.splitTextToSize(body, 180);
    const blockH = 9 + lines.length * 4.4 + 4;
    ensureSpace(blockH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...blue);
    doc.text(title, margin, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(35, 45, 60);
    doc.text(lines, margin, y);
    y += lines.length * 4.4 + 6;
  }

  drawHeader();

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.text(documentTitle, 195, 59, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text(`${documentLabel} #`, 142, 68);
  doc.text(`${documentLabel} date`, 142, 74);
  doc.text(isInvoice ? 'Due date' : 'Valid until', 142, 80);
  if (data.reference) doc.text('Reference', 142, 86);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25, 35, 50);
  doc.text(data.invoiceNumber || '', 195, 68, { align: 'right' });
  doc.text(formatDateForPDF(data.invoiceDate), 195, 74, { align: 'right' });
  doc.text(formatDateForPDF(data.dueDate), 195, 80, { align: 'right' });
  if (data.reference) doc.text(data.reference, 195, 86, { align: 'right' });

  doc.setFillColor(245, 247, 251);
  doc.roundedRect(margin, 55, 112, 34, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blue);
  doc.setFontSize(8);
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE FOR', margin + 5, 63);
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 45);
  doc.text(data.clientName || '', margin + 5, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const clientLines = [data.clientContact, data.clientContactInfo, data.clientAddress].filter(Boolean);
  clientLines.forEach((text, i) => doc.text(text, margin + 5, 76 + i * 5));

  let y = 101;
  drawTextSection('SCOPE OF WORK / PROCESS', data.scopeOfWork);
  drawTextSection('MATERIALS NEEDED & HOW THEY WILL BE USED', data.materials);

  function drawTableHeader() {
    ensureSpace(14);
    doc.setFillColor(...gold);
    doc.rect(margin, y, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...navy);
    doc.text('SERVICE', 18, y + 5.2);
    doc.text('DESCRIPTION', 49, y + 5.2);
    doc.text('QTY', 128, y + 5.2, { align: 'center' });
    doc.text('UNIT PRICE', 160, y + 5.2, { align: 'right' });
    doc.text('TOTAL', 192, y + 5.2, { align: 'right' });
    y += 8;
  }

  drawTableHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const item of items) {
    const desc = item.description || item.service;
    const descLines = doc.splitTextToSize(desc, 67);
    const serviceLines = doc.splitTextToSize(item.service, 27);
    const lineCount = Math.max(descLines.length, serviceLines.length, 1);
    const rowH = Math.max(9, 4.5 * lineCount + 4);

    if (y + rowH > 248) {
      doc.addPage();
      drawHeader();
      y = 55;
      drawTableHeader();
    }

    doc.setDrawColor(...line);
    doc.line(margin, y + rowH, 195, y + rowH);
    doc.setTextColor(30, 40, 55);
    doc.text(serviceLines, 18, y + 5);
    doc.text(descLines, 49, y + 5);
    doc.text(String(item.qty || 0), 128, y + 5, { align: 'center' });
    doc.text(money(item.price), 160, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(money(item.total), 192, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  }

  if (y > 214) {
    doc.addPage();
    drawHeader();
    y = 55;
  } else {
    y += 8;
  }

  const totalsX = 128;
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text('Subtotal', totalsX, y + 4);
  doc.setTextColor(30, 40, 55);
  doc.setFont('helvetica', 'bold');
  doc.text(money(data.totals.subtotal), 195, y + 4, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text(`VAT (${data.totals.vatPercent || 0}%)`, totalsX, y + 4);
  doc.setTextColor(30, 40, 55);
  doc.setFont('helvetica', 'bold');
  doc.text(money(data.totals.vatAmount), 195, y + 4, { align: 'right' });
  y += 9;

  doc.setFillColor(...navy);
  doc.roundedRect(124, y, 71, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('TOTAL', 129, y + 7.5);
  doc.setTextColor(...gold);
  doc.setFontSize(12);
  doc.text(money(data.totals.total), 191, y + 7.5, { align: 'right' });
  y += 21;

  if (y > 224) {
    doc.addPage();
    drawHeader();
    y = 55;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blue);
  doc.setFontSize(9);
  doc.text('PAYMENT DETAILS', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(35, 45, 60);
  doc.setFontSize(8.5);
  const payment = [
    'MOSNET GROUP PTY LTD',
    'Capitec Business Account',
    'Account Number: 1053234040',
    'Branch Code: 450105',
    `Payment reference: ${data.invoiceNumber}`
  ];
  payment.forEach((lineText, i) => doc.text(lineText, margin, y + 6 + i * 4.7));

  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blue);
    doc.text(`${documentTitle} NOTES / TERMS`, 105, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(35, 45, 60);
    const noteLines = doc.splitTextToSize(data.notes, 88);
    doc.text(noteLines, 105, y + 6);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 138, 150);
    doc.text(isInvoice ? 'Thank you for choosing MOSNET GROUP.' : 'Thank you for considering MOSNET GROUP.', margin, 290);
    doc.text(`Page ${p} of ${pages}`, 195, 290, { align: 'right' });
  }

  const safeName = (data.clientName || 'Client').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  const fileName = `MOSNET_${documentTitle}_${data.invoiceNumber || documentLabel}_${safeName || 'Client'}.pdf`;
  return { doc, fileName, data, documentTitle, documentLabel };
}

async function downloadPDF() {
  try {
    const result = await buildPDF();
    if (!result) return;
    result.doc.save(result.fileName);
    saveDraft();
  } catch (err) {
    alert(err.message || 'Could not generate the PDF.');
  }
}

async function sharePDF() {
  try {
    const result = await buildPDF();
    if (!result) return;
    const blob = result.doc.output('blob');
    const file = new File([blob], result.fileName, { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: `MOSNET GROUP ${result.documentLabel} ${result.data.invoiceNumber}`,
        text: `${result.documentLabel} ${result.data.invoiceNumber} from MOSNET GROUP PTY LTD`,
        files: [file]
      });
    } else {
      result.doc.save(result.fileName);
      alert('Direct file sharing is not supported on this browser. The PDF has been downloaded instead, so you can attach it to WhatsApp or email.');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') alert(err.message || 'Could not share the PDF.');
  }
}

function newDocument() {
  const type = getDocumentType();
  const label = type === 'invoice' ? 'invoice' : 'quotation';
  const okay = confirm(`Start a new ${label}? The current form will be cleared.`);
  if (!okay) return;

  const next = currentCounter(type) + 1;
  localStorage.setItem(counterKeyFor(type), String(next));
  localStorage.removeItem(draftKey);

  const selectedType = type;
  form.reset();
  document.querySelector(`input[name="documentType"][value="${selectedType}"]`).checked = true;
  document.getElementById('invoiceNumber').value = documentNumberFromCounter(type, next);
  document.getElementById('invoiceDate').value = localISODate();
  document.getElementById('dueDate').value = nextDate(type === 'invoice' ? 7 : 14);
  document.getElementById('vatPercent').value = 0;
  document.getElementById('scopeOfWork').value = '';
  document.getElementById('materials').value = '';
  itemsContainer.innerHTML = '';
  addItem({ service: 'Building & Plastering', qty: 1 });
  updateDocumentUI();
  calculateTotals();
  refreshAutoGrow();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('addItemBtn').addEventListener('click', () => {
  addItem({ service: 'Building & Plastering', qty: 1 });
  saveDraft();
});

document.querySelectorAll('input[name="documentType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    updateDocumentUI({ resetNumber: true, resetDates: true });
    saveDraft();
  });
});

document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
document.getElementById('shareBtn').addEventListener('click', sharePDF);
document.getElementById('printBtn').addEventListener('click', async () => {
  try {
    const result = await buildPDF();
    if (!result) return;
    const blob = result.doc.output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      result.doc.save(result.fileName);
      alert('Your browser blocked the print window, so the PDF was downloaded instead.');
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (err) {
    alert(err.message || 'Could not prepare the document for printing.');
  }
});
document.getElementById('newInvoiceBtn').addEventListener('click', newDocument);

form.addEventListener('input', event => {
  if (event.target.tagName === 'TEXTAREA') autoGrow(event.target);
  calculateTotals();
  saveDraft();
});
form.addEventListener('change', () => {
  calculateTotals();
  saveDraft();
});

loadDraft();
