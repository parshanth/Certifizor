function openCertificateModal(studentId, name, from, to, email) {
  document.getElementById('certificateModal').classList.remove('hidden');
  document.getElementById('modalStudentId').value = studentId;

  // Generate the certificate with the student's data
  generateCertificate(name, from, to);

  // Save the image data to a hidden input for sending after a short delay
  setTimeout(() => {
    const canvas = document.getElementById('certificateCanvas');
    document.getElementById('certificateImage').value = canvas.toDataURL('image/png');
  }, 800);
}

function closeModal() {
  document.getElementById('certificateModal').classList.add('hidden');
}

// Modify generateCertificate to accept parameters
function generateCertificate(name, fromDate, toDate) {
  const canvas = document.getElementById('certificateCanvas');
  const ctx = canvas.getContext('2d');
  const uniqueId = `KAIZEN${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const message = `This is to certify that ${name} has successfully completed the internship at Kaizenspark Private Limited from ${fromDate} to ${toDate}, demonstrating dedication, professionalism, and a strong willingness to learn throughout the training period.`;
  console.log(fromDate, toDate);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.src = 'cer.jpg';

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw Name (big, bold, centered, and in all capitals)
    ctx.font = 'bold 40px Georgia';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase(), canvas.width / 2, 340);

    // Draw message
    ctx.font = '20px Times New Roman';
    ctx.fillStyle = '#000';
    wrapText(ctx, message, canvas.width / 2, 420, 800, 28);

    // Draw Certificate ID
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    // ctx.fillText(`Certificate ID: ${uniqueId}`, 50, canvas.height - 40);

    // Generate QR Code for verification
    const verifyUrl = `http://localhost:3000/verify/${uniqueId}`;
    QRCode.toDataURL(verifyUrl, (err, url) => {
      if (err) return console.error('QR Error', err);
      const qrImg = new Image();
      qrImg.src = url;
      qrImg.onload = () => {
        ctx.drawImage(qrImg, canvas.width -130, canvas.height - 487, 80, 80);
      };
    });
  };
}

// Helper to wrap long text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function printCertificate() {
  const canvas = document.getElementById('certificateCanvas');
  const dataUrl = canvas.toDataURL();
  const win = window.open('', '_blank');
  win.document.write(`<img src="${dataUrl}" onload="window.print(); window.close();" />`);
  win.document.close();
}

function downloadImage() {
  const canvas = document.getElementById('certificateCanvas');
  const link = document.createElement('a');
  link.download = 'certificate.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function downloadPDF() {
  const canvas = document.getElementById('certificateCanvas');
  const imgData = canvas.toDataURL('image/png');
  const pdf = new window.jspdf.jsPDF('landscape', 'px', [canvas.width, canvas.height]);
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save('certificate.pdf');
}
