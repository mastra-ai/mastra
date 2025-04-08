export const formatDateCell = (date: Date) => {
  // Format the month as a short text representation
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase();
  const day = date.getDate();

  const formattedDay = `${month} ${day}`;

  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
  }).format(date);

  return { day: formattedDay, time };
};
