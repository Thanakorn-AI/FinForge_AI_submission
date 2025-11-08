import { Router } from 'express';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const router = Router();

// Generate Excel file
router.post('/generate-excel', async (req, res) => {
  const { data } = req.body;

  try {
    const workbook = new ExcelJS.Workbook();

    // Create sheets from data
    for (const sheet of data.sheets) {
      const worksheet = workbook.addWorksheet(sheet.name);

      // Add data
      worksheet.addRows(sheet.data);

      // Add styling
      worksheet.getRow(1).font = { bold: true };
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Generate PowerPoint
router.post('/generate-pptx', async (req, res) => {
  const { slides } = req.body;

  try {
    const pptx = new PptxGenJS();

    for (const slideData of slides) {
      const slide = pptx.addSlide();
      slide.addText(slideData.title, { x: 1, y: 1, fontSize: 24, bold: true });
      slide.addText(slideData.content, { x: 1, y: 2, fontSize: 14 });
    }

    const buffer = await pptx.write({ outputType: 'arraybuffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename=presentation.pptx');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Generate Word document
router.post('/generate-docx', async (req, res) => {
  const { content } = req.body;

  try {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: content, size: 24 }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=document.docx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
