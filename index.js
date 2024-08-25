/**
 * Distribución de pacientes Medicina
 */
const fs = require("fs");
const csv = require("csv-parser");
const createExcel = require("./utils/create_excel");
const { convertDateToISOFormat } = require("./utils/index");

const results = [];
const { file_name_med, AUX } = require("./config.json");

// Valida que el archivo exista
if (!fs.existsSync(file_name_med)) {
  console.error(`¡¡El archivo con nombre ${file_name_med} no existe!!`);
  process.exit(1);
}

fs.createReadStream(file_name_med)
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

    /**
     * **************************************************************************************************
     * Retornamos la creación de un excel con todos los datos de los pacientes asistidos con formato XLXS
     * **************************************************************************************************
     */

    // Obtener los encabezados del primer objeto
    const headersAssisted = Object.keys(listPatients[0]);
    // Obtener los datos
    const dataAssisted = listPatients.slice();
    createExcel(
      "PACIENTES ASISTIDOS MEDICINA",
      "PACIENTES_ASISTIDOS_MEDICINA",
      headersAssisted,
      dataAssisted
    );

    /**
     * **********************************************************
     * Reasignamos el nombre SANITAS, PIJAOS, AIC a las entidades
     * **********************************************************
     */
    listPatients.forEach((patient) => {
      if (patient.Entidad.toLowerCase().includes("sanitas")) {
        patient.Entidad = "SANITAS";
      } else if (patient.Entidad.toLowerCase().includes("pijaos")) {
        patient.Entidad = "PIJAOS";
      } else if (patient.Entidad.toLowerCase().includes("aic")) {
        patient.Entidad = "AIC";
      }
    });

    /**
     * *****************************************************************
     * Ponemos color azul a la fila donde el examen sea medicina general
     * *****************************************************************
     */
    listPatients.forEach((patient) => {
      const examen = patient.Examen.toLowerCase();
      if (
        examen.includes("medico general") ||
        examen.includes("consulta medico general")
      ) {
        patient.apply_style = true;
      }
    });

    /**
     * *****************************************************************
     * Realizamos conteo y distribución de pacientes por auxiliar activo
     * *****************************************************************
     */
    let total_patients = listPatients.length;

    let active_doctors = AUX.filter((aux) => aux.active == true);
    
    //Cantidad de pacientes por auxiliar antes de aplicar el porcentaje y el maximo de pacientes
    let patients_per_doctor_before = Math.floor(total_patients / active_doctors.length);
    
    //Cambiar de porcentaje a cantidad de pacientes si existe un maximo de porcentaje al auxiliar
    let sumMaximumPatients = 0; //Suma de los maximos de pacientes
    let numberPatientsWithRestrictions = 0; //Cantidad de auxiliares con restricciones
    active_doctors.forEach((aux) => { 
      if(aux.maxPatientsPercentage != null){
        let max_Patients = Math.floor((aux.maxPatientsPercentage * patients_per_doctor_before) / 100); //Cantidad máxima de pacientes por auxiliar según el porcentaje
        sumMaximumPatients += max_Patients; // Asignamos la cantidad máxima de pacientes por auxiliar
        aux.maxPatients = max_Patients; //Cantidad máxima de pacientes por auxiliar
        numberPatientsWithRestrictions++; //Cantidad de auxiliares con restricciones
      }else if (aux.maxPatients != null){
        sumMaximumPatients += maxPatients; //Cantidad máxima de pacientes por auxiliar
        numberPatientsWithRestrictions++; //Cantidad de auxiliares con restricciones
      }
    });

    // Cantidad de pacientes por auxiliar después de aplicar el porcentaje y el maximo de pacientes 
    let patients_per_doctor = Math.floor((total_patients - sumMaximumPatients) / (active_doctors.length - numberPatientsWithRestrictions));


    /* 
     * *************
     * Asignamos AIC
     * *************
     */

    let patientAIC = listPatients.filter((patient) => patient.Entidad == "AIC");
    let auxAIC = active_doctors.filter((aux) => aux.AIC == true);

    auxAIC.forEach((aux) => {
      if (aux.total_patients >= patients_per_doctor) return;

      patientAIC.forEach((patient) => {
        if (patient.AUXILIAR != "" || aux.total_patients >= patients_per_doctor)
          return;

        patient.AUXILIAR = aux.name.toUpperCase();
        aux.patients.push(patient);
        aux.total_patients++;
      });
    });





    /*
     * ****************
     * Asignamos PIJAOS
     * ****************
     */
    let patientPIJAOS = listPatients.filter(
      (patient) => patient.Entidad == "PIJAOS"
    );
    let auxPIJAOS = active_doctors.filter((aux) => aux.PIJAOS == true);

    auxPIJAOS.forEach((aux) => {
      if (aux.total_patients >= patients_per_doctor) return;

      patientPIJAOS.forEach((patient) => {
        if (patient.AUXILIAR != "" || aux.total_patients >= patients_per_doctor)
          return;

        patient.AUXILIAR = aux.name.toUpperCase();
        aux.patients.push(patient);
        aux.total_patients++;
      });
    });




    /**
     * ****************
     * Filtrar por CALI
     * ****************
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

      if (aux.total_patients >= patients_per_doctor) return;

      caliPatients.forEach((patient) => {
        if (
          totalAsignedCaliPatients < maxCaliPatientsPerAux &&
          patient.AUXILIAR == ""
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

    let auxIndex = 0;  // Índice para recorrer los auxiliares
    let totalAux = active_doctors.length;  // Total de auxiliares

    caliPatients.forEach((patient) => {
      let assigned = false;

      while (!assigned) {
        let aux = active_doctors[auxIndex];

        if (aux.total_patients < patients_per_doctor) {
          patient.AUXILIAR = aux.name.toUpperCase();
          aux.patients.push(patient);
          aux.total_patients++;
          assigned = true;
        }

        auxIndex = (auxIndex + 1) % totalAux;  // Mover al siguiente auxiliar, circularmente
      }
    });





    /*
    * ************************
    * Filtrar por sede Popayán
    * ************************
    */

    let popayanPatients = listPatients.filter(
      (patient) =>
        patient.Sede.toLowerCase().includes("popayan cad") &&
        patient.AUXILIAR == ""
    );
    let auxPopayan = active_doctors.filter((aux) => aux.popayan == true);

    auxPopayan.forEach((aux) => {
      if (aux.total_patients >= patients_per_doctor) return;

      popayanPatients.forEach((patient) => {
        if (patient.AUXILIAR != "" || aux.total_patients >= patients_per_doctor)
          return;

        patient.AUXILIAR = aux.name.toUpperCase();
        aux.patients.push(patient);
        aux.total_patients++;
      });
    });

    // Ordenamos aleatoriamente los auxiliares activos
    active_doctors = active_doctors.sort(() => Math.random() - 0.5);





    /**
     * *******************************
     * Asignar los de medicina general
     * *******************************
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
     * ********************
     * Para todos los demas
     * ********************
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

    let notAsignedPatients = listPatients.filter(
      (patient) => patient.AUXILIAR == ""
    );

    active_doctors.forEach((aux) => {
      let changeAuxUltimate = false;
      if (!changeAuxUltimate) {
        notAsignedPatients.forEach((patient) => {
          if (!changeAuxUltimate && patient.AUXILIAR == "") {
            patient.AUXILIAR = aux.name.toUpperCase();
            aux.patients.push(patient);
            aux.total_patients++;
            changeAuxUltimate = true;
          }
        });
      }
    });







    /**
     * ********************************************************
     * Crear y exportar echivo con la distribución de pacientes
     * ********************************************************
     */


    const headersFinished = [
      "MEDICO",
      "AUXILIAR",
      "TIPO ID",
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
        "TIPO ID": patient.Tip_Doc_,
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
      "DIST. PACIENTES MEDICINA",
      "DIST_PACIENTES_MEDICINA",
      headersFinished,
      dataFinished
    );

    let notAsigned = listPatients.filter((patient) => patient.AUXILIAR == "");





    /**
     * *************************************
     * Validar si hay pacientes no asignados
     * *************************************
     */
    if (notAsigned.length > 0) {
      const headersNotAsigned = [
        "# IDENTIFICACIÓN",
        "NOMBRES Y APELLIDOS DEL PACIENTE",
        "TIPO DE EXAMEN PRIMERA VEZ CONTROL",
        "FECHA DE CITA DEL USUARIO (AAAA-MM-DD)",
        "ASEGURADOR",
        "UNIDAD DE SALUD",
        "ASISTIÓ NO ASISTIÓ A CONSULTA",
      ];

      const dataNotAsigned = notAsigned.map((patient) => {
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
        "PACIENTES NO ASIGNADOS MEDICINA",
        "PACIENTES_NO_ASIGNADOS_MEDICINA",
        headersNotAsigned,
        dataNotAsigned
      );
    }
  });
