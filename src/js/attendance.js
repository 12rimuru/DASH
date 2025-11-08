// Attendance Tracking System
console.log("attendance.js loaded");
console.log("About to fetch attendance data from Supabase");
console.log('Supabase initialized:', window.supabase);

// Helper to get employee name by ID from a map
function getEmployeeNameById(employeeMap, id) {
  return employeeMap[id]?.name || '';
}

// Fetch employees from Supabase (for mapping IDs to names)
async function fetchEmployees() {
  const { data, error } = await window.supabase.from('employees').select('*');
  if (error) {
    console.error('Error fetching employees:', error.message);
    return [];
  }
  return data || [];
}

// Fetch attendance from Supabase and render table
async function renderAttendanceTable() {
  try {
    console.log('renderAttendanceTable called');
    let attendanceData;
    try {
      attendanceData = await fetchAttendanceData();
      // Log the data to see what we're working with
      console.log('Attendance Data to render:', attendanceData);
    } catch (fetchError) {
      console.error('Error fetching attendance data:', fetchError);
      showNotification('Error fetching attendance data: ' + fetchError.message, 'error');
      throw new Error('Failed to fetch attendance data: ' + fetchError.message);
    }
    // Get the table body - make sure we're using the correct selector
    let tableBody = document.getElementById('attendance-history-body');
    // Debug the table body element
    console.log('Table body element:', tableBody);
    if (!tableBody) {
      console.error('attendance-history-body element not found');
      // Try to find the table another way
      console.log('Trying to find table by query selector');
      const alternateTableBody = document.querySelector('#attendance-section table tbody');
      if (alternateTableBody) {
        console.log('Found table by alternate method');
        tableBody = alternateTableBody;
      } else {
        console.error('Could not find attendance table by any method');
        // Last resort - try to find any tbody in the attendance section
        const anyTableBody = document.querySelector('#attendance-section tbody');
        if (anyTableBody) {
          console.log('Found a tbody element in the attendance section');
          tableBody = anyTableBody;
        } else {
          console.error('No tbody element found in the attendance section');
          showNotification('Error: Could not find attendance table element', 'error');
          throw new Error('Table element not found: attendance-history-body');
        }
      }
    }
    // Clear existing content
    console.log('Clearing table body content');
    tableBody.innerHTML = '';
    if (!attendanceData || attendanceData.length === 0) {
      // Display a message when no data is found
      console.log('No attendance data found, displaying empty message');
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="5" class="text-center">No attendance records found</td>`;
      tableBody.appendChild(emptyRow);
      return;
    }
    console.log(`Adding ${attendanceData.length} records to the table`);
    // Add each record to the table
    attendanceData.forEach((record, index) => {
      console.log(`Processing record ${index + 1}:`, record);
      try {
        if (!record) {
          console.error(`Record ${index + 1} is null or undefined`);
          return;
        }
        if (!record.timestamp) {
          console.error(`Record ${index + 1} has no timestamp:`, record);
          return;
        }
        const { date, time } = formatDateTime(record.timestamp);
        const row = document.createElement('tr');
        // Check what type values are actually in the database
        console.log(`Record ${index + 1} type value:`, record.type);
        // Determine if it's a time in or time out
        // Check for various possible type values
        const isClockIn = record.type === 'time-in' || record.type === 'in' || record.type === 'clock-in' || record.type === 'clockin';
        const typeClass = isClockIn ? 'time-in' : 'time-out';
        const typeText = isClockIn ? 'Time In' : 'Time Out';
        // Create the row with the data from Supabase
        row.innerHTML = `
          <td>${record.user_name || 'Unknown'}</td>
          <td>${date}</td>
          <td>${time}</td>
          <td><span class="time-badge ${typeClass}">${typeText}</span></td>
          
        `;
        // Add the row to the table
        tableBody.appendChild(row);
        console.log(`Row ${index + 1} added to table`);
      } catch (err) {
        console.error(`Error processing record ${index + 1}:`, err);
        console.error('Record data:', record);
      }
    });
    console.log('Table rendering complete');
  } catch (error) {
    console.error('Error in renderAttendanceTable:', error);
    showNotification('Error rendering attendance table: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded, initializing attendance table");
  // Add click event listener to the attendance nav link
  const attendanceNavLink = document.getElementById('nav-attendance');
  if (attendanceNavLink) {
    attendanceNavLink.addEventListener('click', function() {
      console.log("Attendance tab clicked, rendering table");
      setTimeout(() => {
        renderAttendanceTable();
      }, 100); // Small delay to ensure the section is visible
    });
  }
  // Check if we're on the attendance page
  if (document.getElementById('attendance-section')) {
    console.log("Attendance section found, rendering table");
    renderAttendanceTable();
  } else {
    console.log("Attendance section not found in current view");
  }
});

// Fetch attendance data from Supabase
async function fetchAttendanceData() {
  console.log('fetchAttendanceData called');
  try {
    if (!window.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }
    const { data, error } = await window.supabase
      .from('attendance')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) {
      console.error('Error fetching attendance data:', error.message);
      return [];
    }
    console.log('Supabase response:', { data, error: null });
    return data || [];
  } catch (err) {
    console.error('Exception in fetchAttendanceData:', err);
    return [];
  }
}

// Format timestamp into date and time components
function formatDateTime(timestamp) {
  console.log('Formatting timestamp:', timestamp);
  try {
    if (!timestamp) {
      console.error('Invalid timestamp:', timestamp);
      return { date: 'Invalid date', time: 'Invalid time' };
    }
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      console.error('Unrecognized timestamp format:', timestamp);
      return { date: 'Invalid date', time: 'Invalid time' };
    }
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date object:', date);
      return { date: 'Invalid date', time: 'Invalid time' };
    }
    // Convert to Philippine time
    const dateFormatted = date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila' });
    const timeFormatted = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
    return { date: dateFormatted, time: timeFormatted };
  } catch (err) {
    console.error('Error formatting date/time:', err);
    return { date: 'Error', time: 'Error' };
  }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  console.log(`Notification (${type}): ${message}`);
  // Use the global notification system if available
  if (window.showNotification && window.showNotification !== showNotification) {
    window.showNotification(message, type);
    return;
  }
  // Fallback to jQuery notify if available
  if (typeof $ !== 'undefined' && typeof $.notify === 'function') {
    $.notify({ message: message }, {
      type: type,
      placement: { from: 'top', align: 'right' },
      z_index: 9999,
      delay: 3000,
      animate: { enter: 'animated fadeInDown', exit: 'animated fadeOutUp' }
    });
    return;
  }
  // Fallback: alert
  alert(`${type.toUpperCase()}: ${message}`);
}

// After recording attendance, trigger employee table reload
async function handleAttendanceAction(data) {
  try {
    await window.api.recordAttendance(data);
    // Reload employee table to reflect status change
    if (window.loadEmployees) {
      await window.loadEmployees();
    }
  } catch (error) {
    console.error('Error handling attendance action:', error);
    showNotification('Error updating attendance and employee table.', 'error');
  }
}
// Replace direct calls to window.api.recordAttendance with handleAttendanceAction in clock-in/clock-out logic