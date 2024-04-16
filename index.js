const fs = require("fs");
const csv = require("csv-parser");
const createExcel = require("./create_excel");
const { convertDateToISOFormat } = require("./utils");

const results = [];
const { file_name, AUX } = require("./config.json");

// Valida que el archivo exista
if (!fs.existsSync(file_name)) {
  console.error(`¡¡El archivo con nombre ${file_name} no existe!!`);
  process.exit(1);
}

fs.createReadStream(file_name)
  .pipe(csv())
  .on("data", (data) => {
    // Limpiar las claves eliminando el carácter invisible al principio de la clave
    const cleanData = {};
    let isEmpty = true;
    Object.keys(data).forEach((key) => {
      const cleanedKey = key.replace(/^\uFEFF/, ""); // Elimina el carácter invisible al principio de la clave
      if (data[key].trim() !== "") {
        // Verifica si el valor no está vacío después de eliminar los espacios en blanco
        cleanData[cleanedKey] = data[key];
        isEmpty = false;
      }
    });

    //Agregar los valores de MEDICO y AUXILIAR a cada registro si no está vacío
    if (!isEmpty) {
      cleanData.MEDICO = cleanData["Médico"];
      cleanData.AUXILIAR = "";
    }
    results.push(cleanData);
  })
  .on("end", async () => {
    // Filtramos los registros asistidos
    let listPatients = results.filter(
      (patient) => patient.Estado_cita === "Asistida"
    );

    // Retornamos la creacion de un excel con todos los datos de los pacientes asistidos con formato XLXS

    // Obtener los encabezados del primer objeto
    const headersAssisted = Object.keys(listPatients[0]);
    // Obtener los datos
    const dataAssisted = listPatients.slice();
    createExcel(
      "PACIENTES ASISTIDOS",
      "PACIENTES_ASISTIDOS",
      headersAssisted,
      dataAssisted
    );

    //Reasignamos el nombre SANITAS, PIJAOS, AIC a las entidades
    listPatients.forEach((patient) => {
      if (patient.Entidad.toLowerCase().includes("sanitas")) {
        patient.Entidad = "SANITAS";
      } else if (patient.Entidad.toLowerCase().includes("pijaos")) {
        patient.Entidad = "PIJAOS";
      } else if (patient.Entidad.toLowerCase().includes("aic")) {
        patient.Entidad = "AIC";
      }
    });

    //Ponemos color azul a la fila donde la entidad sea SANITAS
    listPatients.forEach((patient) => {
      const examen = patient.Examen.toLowerCase();
      if (
        examen.includes("medico general") ||
        examen.includes("consulta medico general")
      ) {
        patient.apply_style = true;
      }
    });

    // // Obtener los encabezados del primer objeto
    // const headersRename = Object.keys(listPatients[0]);
    // // Obtener los datos (omitir el primer objeto, ya que contiene los encabezados)
    // const dataRename = listPatients.slice(1);

    // await createExcel(
    //   "Antes de la asignacion",
    //   "antes_de_asignacion",
    //   headersRename,
    //   dataRename
    // );

    // Asignamos los pacientes a los médicos
    let tota_patients = listPatients.length;
    //auxiliares activos
    let active_doctors = AUX.filter((aux) => aux.active == true);
    let patients_per_doctor = Math.floor(tota_patients / active_doctors.length);
    let remainder = tota_patients % active_doctors.length;

    patients_per_doctor -= Math.ceil(remainder / active_doctors.length);

    //Asignamos AIC
    let patientAIC = listPatients.filter((patient) => patient.Entidad == "AIC");
    let auxAIC = active_doctors.find((aux) => aux.AIC == true);
    patientAIC.forEach((patient) => {
      if (patient.AUXILIAR == "") {
        if (auxAIC.name) {
          if (auxAIC.total_patients < patients_per_doctor) {
            auxAIC.patients.push(patient);
            auxAIC.total_patients++;
            patient.AUXILIAR = auxAIC.name.toUpperCase();
          }
        } else {
          auxAIC.forEach((aux) => {
            if (aux.total_patients < patients_per_doctor) {
              aux.patients.push(patient);
              auxAIC.total_patients++;
              patient.AUXILIAR = aux.name.toUpperCase();
            }
          });
        }
      }
    });

    //Asignamos PIJAOS
    let patientPIJAOS = listPatients.filter(
      (patient) => patient.Entidad == "PIJAOS"
    );
    let auxPIJAOS = active_doctors.find((aux) => aux.PIJAOS == true);
    patientPIJAOS.forEach((patient) => {
      if (patient.AUXILIAR == "") {
        if (auxPIJAOS.name) {
          if (auxPIJAOS.total_patients < patients_per_doctor) {
            auxPIJAOS.patients.push(patient);
            auxPIJAOS.total_patients++;
            patient.AUXILIAR = auxPIJAOS.name.toUpperCase();
          }
        } else {
          auxPIJAOS.forEach((aux) => {
            if (aux.total_patients < patients_per_doctor) {
              aux.patients.push(patient);
              auxPIJAOS.total_patients++;
              patient.AUXILIAR = aux.name.toUpperCase();
            }
          });
        }
      }
    });

    // Ordenamos aleatoriamente los auxiliares activos
    active_doctors = active_doctors.sort(() => Math.random() - 0.5);

    /**
     * Asignar los de medicina general
     */

    // Calcular la cantidad de pacientes de medicina general
    let medGeneralPatients = listPatients.filter(
      (patient) =>
        (patient.Examen.toLowerCase().includes("medico general") ||
          patient.Examen.toLowerCase().includes("consulta medico general")) &&
        patient.AUXILIAR == ""
    );

    // Calcular la cantidad máxima de pacientes de medicina general por auxiliar
    const maxMedGeneralPatientsPerAux = Math.floor(
      medGeneralPatients.length / active_doctors.length
    );

    active_doctors.forEach((aux) => {
      let totalAsignedGeneralPatients = 0;
      medGeneralPatients.forEach((patient) => {
        if (
          totalAsignedGeneralPatients < maxMedGeneralPatientsPerAux &&
          patient.AUXILIAR == "" &&
          aux.total_patients < patients_per_doctor
        ) {
          patient.AUXILIAR = aux.name.toUpperCase();
          aux.patients.push(patient);
          aux.total_patients++;
          totalAsignedGeneralPatients++;
        }
      });
      // Eliminar los pacientes asignados de la lista de pacientes de medicina general
      medGeneralPatients = medGeneralPatients.filter(
        (patient) => patient.AUXILIAR == ""
      );
    });

    active_doctors.forEach((aux) => {
      let changeAuxGeneral = false;
      if (!changeAuxGeneral && aux.total_patients < patients_per_doctor) {
        medGeneralPatients.forEach((patient) => {
          if (!changeAuxGeneral && patient.AUXILIAR == "") {
            patient.AUXILIAR = aux.name.toUpperCase();
            aux.patients.push(patient);
            aux.total_patients++;
            changeAuxGeneral = true;
          }
        });
      }
    });

    /**
     * Filtrar por CALI
     */

    // Calcular la cantidad de pacientes de CALI
    let caliPatients = listPatients.filter(
      (patient) =>
        patient.Sede.toLowerCase().includes("cali") && patient.AUXILIAR == ""
    );

    // calcular la cantidad máxima de pacientes de CALI por auxiliar
    const maxCaliPatientsPerAux = Math.floor(
      caliPatients.length / active_doctors.length
    );

    active_doctors.forEach((aux) => {
      let totalAsignedCaliPatients = 0;
      caliPatients.forEach((patient) => {
        if (
          totalAsignedCaliPatients < maxCaliPatientsPerAux &&
          patient.AUXILIAR == "" &&
          aux.total_patients < patients_per_doctor
        ) {
          patient.AUXILIAR = aux.name.toUpperCase();
          aux.patients.push(patient);
          aux.total_patients++;
          totalAsignedCaliPatients++;
        }
      });
      // Eliminar los pacientes asignados de la lista de pacientes de CALI
      caliPatients = caliPatients.filter((patient) => patient.AUXILIAR == "");
    });

    // Asignar los pacientes restantes de CALI
    active_doctors.forEach((aux) => {
      let changeAux = false;
      if (!changeAux && aux.total_patients < patients_per_doctor) {
        caliPatients.forEach((patient) => {
          if (!changeAux && patient.AUXILIAR == "") {
            patient.AUXILIAR = aux.name.toUpperCase();
            aux.patients.push(patient);
            aux.total_patients++;
            changeAux = true;
          }
        });
      }
    });

    /**
     * Para todos los demas
     */

    // Asignar ya los demas pacientes a los auxiliares
    active_doctors.forEach((aux) => {
      listPatients.forEach((patient) => {
        if (
          patient.AUXILIAR == "" &&
          aux.total_patients < patients_per_doctor
        ) {
          patient.AUXILIAR = aux.name.toUpperCase();
          aux.patients.push(patient);
          aux.total_patients++;
        }
      });
    });

    const notAsignedPatients = listPatients.filter(
      (patient) => patient.AUXILIAR == ""
    );

    notAsignedPatients.forEach((patient) => {
      active_doctors.forEach((aux) => {
        if (patient.AUXILIAR == "") {
          patient.AUXILIAR = aux.name.toUpperCase();
          aux.patients.push(patient);
          aux.total_patients++;
        }
      });
    });

    const headersFinished = [
      "MEDICO",
      "AUXILIAR",
      "# IDENTIFICACIÓN",
      "NOMBRES Y APELLIDOS DEL PACIENTE",
      "TIPO DE EXAMEN PRIMERA VEZ CONTROL",
      "FECHA DE CITA DEL USUARIO (AAAA-MM-DD)",
      "FECHA DISTRIBUCIÓN (AAAA-MM-DD)", //dia siguiente a la fecha actual
      "ASEGURADOR",
      "UNIDAD DE SALUD",
      "ASISTIÓ NO ASISTIÓ A CONSULTA",
    ];

    // Ordenar los pacientes por nombre de auxiliar y médico
    listPatients = listPatients.sort((a, b) => {
      if (a.AUXILIAR > b.AUXILIAR) {
        return 1;
      } else if (a.AUXILIAR < b.AUXILIAR) {
        return -1;
      } else {
        if (a.MEDICO > b.MEDICO) {
          return 1;
        } else if (a.MEDICO < b.MEDICO) {
          return -1;
        } else {
          return 0;
        }
      }
    });

    // Crear la fecha de mañana para la distribución
    let tomorrow = new Date(new Date().setHours(0, 0, 0, 0)); // Establece la hora a las 00:00:00 de hoy
    tomorrow.setDate(tomorrow.getDate() + 1); // Añade un día
    let formattedDate = tomorrow.toISOString().split("T")[0];

    const dataFinished = listPatients.map((patient) => {
      return {
        MEDICO: patient.MEDICO,
        AUXILIAR: patient.AUXILIAR,
        "# IDENTIFICACIÓN": patient.Documento,
        "NOMBRES Y APELLIDOS DEL PACIENTE": patient.Paciente,
        "TIPO DE EXAMEN PRIMERA VEZ CONTROL": patient.Tipo_de_examen1,
        "FECHA DE CITA DEL USUARIO (AAAA-MM-DD)": convertDateToISOFormat(
          patient.Fecha_cita
        ),
        "FECHA DISTRIBUCIÓN (AAAA-MM-DD)": formattedDate,
        ASEGURADOR: patient.Entidad,
        "UNIDAD DE SALUD": patient.Sede,
        "ASISTIÓ NO ASISTIÓ A CONSULTA":
          patient.Estado_cita === "Asistida" ? "ASISTIÓ" : patient.Estado_cita,
        apply_style: patient.apply_style,
      };
    });

    createExcel(
      "DIST. PACIENTES",
      "DIST_PACIENTES",
      headersFinished,
      dataFinished
    );

    // validar si hay pacientes no asignados
    if (notAsignedPatients.length > 0) {
      const headersNotAsigned = [
        "# IDENTIFICACIÓN",
        "NOMBRES Y APELLIDOS DEL PACIENTE",
        "TIPO DE EXAMEN PRIMERA VEZ CONTROL",
        "FECHA DE CITA DEL USUARIO (AAAA-MM-DD)",
        "ASEGURADOR",
        "UNIDAD DE SALUD",
        "ASISTIÓ NO ASISTIÓ A CONSULTA",
      ];

      const dataNotAsigned = notAsignedPatients.map((patient) => {
        return {
          "# IDENTIFICACIÓN": patient.Documento,
          "NOMBRES Y APELLIDOS DEL PACIENTE": patient.Paciente,
          "TIPO DE EXAMEN PRIMERA VEZ CONTROL": patient.Tipo_de_examen1,
          "FECHA DE CITA DEL USUARIO (AAAA-MM-DD)": convertDateToISOFormat(
            patient.Fecha_cita
          ),
          ASEGURADOR: patient.Entidad,
          "UNIDAD DE SALUD": patient.Sede,
          "ASISTIÓ NO ASISTIÓ A CONSULTA":
            patient.Estado_cita === "Asistida"
              ? "ASISTIÓ"
              : patient.Estado_cita,
        };
      });

      createExcel(
        "PACIENTES NO ASIGNADOS",
        "PACIENTES_NO_ASIGNADOS",
        headersNotAsigned,
        dataNotAsigned
      );
    }
  });
