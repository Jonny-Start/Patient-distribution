function convertDateToISOFormat(dateString) {
  // Split the string to get date and time parts
  const dateParts = dateString.split(" ");

  // Get the date part and split it into day, month, and year
  const date = dateParts[0].split("/");
  const day = parseInt(date[0]);
  const month = parseInt(date[1]) - 1; // Subtract 1 from the month because in JavaScript months are zero-based
  const year = parseInt(date[2]);

  // Get the time part and split it into hours, minutes, and seconds
  const time = dateParts[1].split(":");
  let hours = parseInt(time[0]);
  const minutes = parseInt(time[1]);
  const seconds = parseInt(time[2]);

  // Adjust the hours for 24-hour format if it's PM
  if (dateParts[2] === "PM" && hours < 12) {
    hours += 12;
  }

  // Create a Date object with the obtained date and time
  const dateObject = new Date(year, month, day, hours, minutes, seconds);

  // Convert the date to ISO format and get only the date part (YYYY-MM-DD)
  const isoDate = dateObject.toISOString().split("T")[0];

  return isoDate;
}

module.exports = { convertDateToISOFormat };
