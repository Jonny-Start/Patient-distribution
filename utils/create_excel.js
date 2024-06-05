module.exports = function createExcel(nameSheet, file_name, headers, data) {
  const excel = require("exceljs");
  const workbook = new excel.Workbook();
  const worksheet = workbook.addWorksheet(nameSheet);

  // Agregar encabezados a la hoja de cálculo
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: 30,
  }));

  // Aplicar estilo a cada columna
  worksheet.columns.forEach((column) => {
    column.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB8CCE4" },
      };
      cell.font = { bold: true };
    });
  });

  const rowStyles = [
    // Estilo para las filas donde apply_style es true
    {
      style: {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB8CCE4" },
        },
      },
      filter: (rowData) => rowData.apply_style,
    },
  ];

  // Agregar filas a la hoja de cálculo con estilos personalizados
  data.forEach((rowData) => {
    const row = worksheet.addRow(rowData);
    // Aplicar estilos personalizados a las filas basadas en los datos
    rowStyles.forEach((style) => {
      if (style.filter && style.filter(rowData)) {
        row.eachCell((cell) => {
          Object.keys(style.style).forEach((key) => {
            cell[key] = style.style[key];
          });
        });
      }
    });
  });

  // worksheet.addRows(data);
  workbook.xlsx.writeFile(`${file_name}.xlsx`).then(() => {
    console.log("Excel creado con éxito: ", `${file_name}.xlsx`);
  });
};

// worksheet.columns = [
//   { header: "Fecha", key: "Fecha", width: 20 },
//   { header: "Hora", key: "Hora", width: 20 },
//   { header: "Paciente", key: "Paciente", width: 20 },
//   { header: "Documento", key: "Documento", width: 20 },
//   { header: "Estado_cita", key: "Estado_cita", width: 20 },
//   { header: "MEDICO", key: "MEDICO", width: 20 },
//   { header: "AUXILIAR", key: "AUXILIAR", width: 20 },
// ];
