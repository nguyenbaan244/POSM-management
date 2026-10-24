import * as xlsx from "xlsx";

export interface ExcelColumn<T = any> {
  header: string;
  key: keyof T | string;
  width?: number;
  format?: (value: any, row: T) => any;
}

/**
 * Exports data to an Excel (.xlsx) file and triggers download
 */
export function exportToExcel<T = any>({
  filename,
  sheetName = "Sheet1",
  data,
  columns,
  title,
  subtitles = [],
}: {
  filename: string;
  sheetName?: string;
  data: T[];
  columns: ExcelColumn<T>[];
  title?: string;
  subtitles?: string[];
}) {
  if (!data || data.length === 0) {
    alert("Không có dữ liệu để xuất file Excel.");
    return;
  }

  // Build rows for sheet
  const rows: any[][] = [];

  // Optional Title & Subtitles
  if (title) {
    rows.push([title]);
    for (const sub of subtitles) {
      rows.push([sub]);
    }
    rows.push([]); // blank line
  }

  // Header row
  const headerRow = columns.map(col => col.header);
  rows.push(headerRow);

  // Data rows
  data.forEach((item, index) => {
    const rowValues = columns.map(col => {
      let val = (item as any)[col.key];
      if (col.format) {
        val = col.format(val, item);
      }
      return val ?? "";
    });
    rows.push(rowValues);
  });

  // Create worksheet
  const ws = xlsx.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = columns.map(col => ({
    wch: col.width || Math.max(col.header.length + 4, 12)
  }));

  // Create workbook
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  // Ensure filename has .xlsx
  const finalFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  // Write and download
  xlsx.writeFile(wb, finalFilename);
}
