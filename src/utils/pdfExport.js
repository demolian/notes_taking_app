import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Export single note to PDF
export const exportNoteToPDF = async (note, decryptData) => {
  try {
    const title = typeof note.title === 'string' ? note.title : decryptData(note.title);
    const content = typeof note.content === 'string' ? note.content : decryptData(note.content);
    
    // Create a temporary div to render the content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '800px';
    tempDiv.style.padding = '20px';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.fontSize = '14px';
    tempDiv.style.lineHeight = '1.6';
    
    // Add title and content
    tempDiv.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px;">
          ${title}
        </h1>
        <p style="color: #666; font-size: 12px; margin-bottom: 20px;">
          Created: ${new Date(note.created_at).toLocaleDateString()}
        </p>
        <div style="color: #333;">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    // Convert to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Remove temporary div
    document.body.removeChild(tempDiv);
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save the PDF
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_note.pdf`;
    pdf.save(fileName);
    
    return true;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export note to PDF');
  }
};

// Export multiple notes to PDF
export const exportMultipleNotesToPDF = async (notes, decryptData) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    let isFirstPage = true;
    
    for (const note of notes) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      
      const title = typeof note.title === 'string' ? note.title : decryptData(note.title);
      const content = typeof note.content === 'string' ? note.content : decryptData(note.content);
      
      // Create temporary div for this note
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '14px';
      tempDiv.style.lineHeight = '1.6';
      
      // Strip HTML tags for plain text content
      const plainContent = content.replace(/<[^>]*>/g, '').substring(0, 1000);
      
      tempDiv.innerHTML = `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 1px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">
            ${title}
          </h2>
          <p style="color: #666; font-size: 10px; margin-bottom: 15px;">
            Created: ${new Date(note.created_at).toLocaleDateString()}
          </p>
          <div style="color: #333; font-size: 12px;">
            ${plainContent}${plainContent.length >= 1000 ? '...' : ''}
          </div>
        </div>
      `;
      
      document.body.appendChild(tempDiv);
      
      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(tempDiv);
      
      // Add to PDF
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, isFirstPage ? 10 : 10, imgWidth, Math.min(imgHeight, 270));
      
      isFirstPage = false;
    }
    
    // Save the PDF
    const fileName = `notes_export_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    return true;
  } catch (error) {
    console.error('Error exporting multiple notes to PDF:', error);
    throw new Error('Failed to export notes to PDF');
  }
};