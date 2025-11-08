const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
ipcMain.on('print', (event) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.print({
      printBackground: true,
      silent: false,
      // Show print preview dialog
      preview: false, // Set to false to use system print dialog instead
      margins: {
        marginType: 'default'
      },
      landscape: false,
      scaleFactor: 100,
      shouldPrintBackgrounds: true,
      printSelectionOnly: false,
      color: true
    }, (success, failureReason) => {
      if (!success) {
        console.log('Print failed:', failureReason);
      }
    });
  }
});

// Enable hot reload for development
try {
  // Check for development mode using either NODE_ENV or command line args
  const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('--dev');
  
  if (isDev) {
    // Use electron-reload for hot reloading
    const electronReload = require('electron-reload');
    // Watch all files and subdirectories in the project
    electronReload([__dirname], {
      // Specify which files to watch (including JS, HTML, CSS)
      ignored: /node_modules|[/\\]\./,
      // Path to electron executable
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      // Use 'exit' for a complete restart of the application
      hardResetMethod: 'exit'
    });
    console.log('Auto-reload enabled with electron-reload - watching for file changes');
  }
} catch (err) {
  console.error('Error enabling auto-reload:', err);
}

// Initialize data store
const store = new Store();

// Initialize attendance records if they don't exist
if (!store.has('attendance')) {
  store.set('attendance', []);
}

// Initialize pending sync queue if it doesn't exist
if (!store.has('pendingSync')) {
  store.set('pendingSync', []);
}

// Normalize existing employee emails and deduplicate by email on startup
try {
  const employees = store.get('employees') || [];
  if (employees.length > 0) {
    const seen = new Set();
    const normalized = [];
    let changed = false;

    for (const emp of employees) {
      const normEmail = ((emp.email || '').trim().toLowerCase());
      // Update normalized email
      if (emp.email !== normEmail) {
        emp.email = normEmail;
        changed = true;
      }
      // Keep first occurrence per email
      if (normEmail && seen.has(normEmail)) {
        changed = true;
        continue;
      }
      if (normEmail) seen.add(normEmail);
      normalized.push(emp);
    }

    if (changed) {
      store.set('employees', normalized);
      console.log(`Normalized employee emails and deduped: kept ${normalized.length}/${employees.length}`);
    }
  }
} catch (e) {
  console.error('Error normalizing/deduping employee emails:', e);
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
let twofaWindow;

function createWindow() {
  // Create the browser window
  const isPackaged = app.isPackaged;
  const iconPath = isPackaged
    ? path.join(__dirname, 'assets', 'icons', 'icon.ico')
    : path.join(__dirname, 'assets', 'images', 'logo.png');

  mainWindow = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: iconPath
  });
    
  // Load the index.html of the app
  mainWindow.loadFile('src/index.html');

  // Open DevTools in development mode
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.webContents.openDevTools();
    console.log('DevTools opened automatically in development mode');
  }

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
// Remove this block to prevent main window from opening at startup
// app.whenReady().then(() => {
//   createWindow();
//
//   app.on('activate', function () {
//     // On macOS it's common to re-create a window when the dock icon is clicked
//     if (mainWindow === null) createWindow();
//   });
// });

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Offline Sync Queue IPC Handlers
ipcMain.handle('enqueue-sync', async (event, operation) => {
  try {
    const queue = store.get('pendingSync') || [];
    const op = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      ...operation,
      timestamp: new Date().toISOString()
    };
    queue.push(op);
    store.set('pendingSync', queue);
    return { success: true, id: op.id, pendingCount: queue.length };
  } catch (error) {
    console.error('Error enqueueing sync operation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-pending-sync', async () => {
  try {
    return store.get('pendingSync') || [];
  } catch (error) {
    console.error('Error getting pending sync operations:', error);
    return [];
  }
});

ipcMain.handle('mark-sync-complete', async (event, id) => {
  try {
    const queue = store.get('pendingSync') || [];
    const newQueue = queue.filter(op => op.id !== id);
    store.set('pendingSync', newQueue);
    return { success: true, pendingCount: newQueue.length };
  } catch (error) {
    console.error('Error marking sync operation complete:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for database operations
ipcMain.handle('get-employees', async () => {
  return store.get('employees') || [];
});

ipcMain.handle('add-employee', async (event, employee) => {
  const employees = store.get('employees') || [];
  
  // Normalize email and check uniqueness by email only
  const newEmail = (employee.email || '').trim().toLowerCase();
  
  // Allow 'n/a' as a non-unique email
  if (newEmail !== 'n/a') {
    const employeeExists = employees.some(emp => ((emp.email || '').trim().toLowerCase()) === newEmail);
    if (employeeExists) {
      return { success: false, error: 'This email is already registered' };
    }
  }
  
  const newEmployee = {
    id: Date.now().toString(),
    ...employee,
    email: newEmail,
    createdAt: new Date().toISOString()
  };
  
  employees.push(newEmployee);
  store.set('employees', employees);
  
  // Send notification to renderer process that employee was added
  // This will trigger an automatic UI refresh
  event.sender.send('employee-added');
  return newEmployee;
});

ipcMain.handle('update-employee', async (event, updatedEmployee) => {
  const employees = store.get('employees') || [];
  const index = employees.findIndex(emp => emp.id === updatedEmployee.id);
  
  if (index !== -1) {
    employees[index] = {
      ...employees[index],
      ...updatedEmployee,
      updatedAt: new Date().toISOString()
    };
    store.set('employees', employees);
    return employees[index];
  }
  return null;
});

// Handle updating employee signature
ipcMain.handle('update-employee-signature', async (event, { employeeId, signatureData }) => {
  const employees = store.get('employees') || [];
  const index = employees.findIndex(emp => emp.id === employeeId);
  
  if (index !== -1) {
    employees[index] = {
      ...employees[index],
      signature: signatureData,
      updatedAt: new Date().toISOString()
    };
    store.set('employees', employees);
    return employees[index];
  }
  return null;
});

ipcMain.handle('delete-employee', async (event, id) => {
  const employees = store.get('employees') || [];
  const newEmployees = employees.filter(emp => emp.id !== id);
  store.set('employees', newEmployees);
  
  // Send notification to renderer process that employee was deleted
  // This will trigger an automatic UI refresh
  event.sender.send('employee-deleted');
  return true;
});

ipcMain.handle('get-employee', async (event, id) => {
  const employees = store.get('employees') || [];
  return employees.find(emp => emp.id === id) || null;
});

ipcMain.handle('get-payheads', async () => {
  return store.get('payheads') || [];
});

ipcMain.handle('add-payhead', async (event, payhead) => {
  const payheads = store.get('payheads') || [];
  const newPayhead = {
    id: Date.now().toString(),
    ...payhead,
    createdAt: new Date().toISOString()
  };
  
  payheads.push(newPayhead);
  store.set('payheads', payheads);
  return newPayhead;
});

ipcMain.handle('update-payhead', async (event, updatedPayhead) => {
  const payheads = store.get('payheads') || [];
  const index = payheads.findIndex(ph => ph.id === updatedPayhead.id);
  
  if (index !== -1) {
    payheads[index] = {
      ...payheads[index],
      ...updatedPayhead,
      updatedAt: new Date().toISOString()
    };
    store.set('payheads', payheads);
    return payheads[index];
  }
  return null;
});

ipcMain.handle('delete-payhead', async (event, id) => {
  const payheads = store.get('payheads') || [];
  const newPayheads = payheads.filter(ph => ph.id !== id);
  store.set('payheads', newPayheads);
  return true;
});

ipcMain.handle('generate-salary', async (event, { employeeId, month, year, week, half, paymentCycle, payheads, signature, daysWorked, dailyRate }) => {
  const salaries = store.get('salaries') || [];
  const newSalary = {
    id: Date.now().toString(),
    employeeId,
    month,
    year,
    week: week || null,
    half: half != null ? (Number(half) || half) : null,
    paymentCycle: paymentCycle || 'monthly', // 'monthly' or 'weekly'
    payheads,
    signature: signature || null,
    daysWorked: daysWorked != null ? Number(daysWorked) : null,
    dailyRate: dailyRate != null ? Number(dailyRate) : null,
    totalEarnings: payheads.filter(p => p.type === 'earning').reduce((sum, p) => sum + p.amount, 0),
    totalDeductions: payheads.filter(p => p.type === 'deduction').reduce((sum, p) => sum + p.amount, 0),
    createdAt: new Date().toISOString()
  };
  
  newSalary.netSalary = newSalary.totalEarnings - newSalary.totalDeductions;
  
  salaries.push(newSalary);
  store.set('salaries', salaries);
  return newSalary;
});

ipcMain.handle('get-salaries', async (event, { employeeId, month, year, week, half, paymentCycle } = {}) => {
  try {
    console.log('get-salaries handler called with filters:', { employeeId, month, year, week, half, paymentCycle });
    
    // Initialize salaries array if it doesn't exist
    if (!store.has('salaries')) {
      console.log('Initializing empty salaries array in store');
      store.set('salaries', []);
    }
    
    const salaries = store.get('salaries') || [];
    console.log(`Retrieved ${salaries.length} salaries from store`);
    
    let result = salaries;
    
    if (employeeId) {
      result = salaries.filter(s => s.employeeId === employeeId);
      console.log(`Filtered by employeeId: ${employeeId}, found ${result.length} salaries`);
    }
    
    if (paymentCycle === 'weekly' && week && month && year) {
      result = salaries.filter(s => 
        Number(s.month) === Number(month) && 
        Number(s.year) === Number(year) && 
        Number(s.week) === Number(week) &&
        s.paymentCycle === 'weekly'
      );
      console.log(`Filtered by weekly cycle: month=${month}, year=${year}, week=${week}, found ${result.length} salaries`);
    }
    
    if (paymentCycle === '15days' && half && month && year) {
      result = salaries.filter(s => 
        Number(s.month) === Number(month) && 
        Number(s.year) === Number(year) && 
        (Number(s.half) === Number(half) || String(s.half) === String(half)) &&
        s.paymentCycle === '15days'
      );
      console.log(`Filtered by 15-day cycle: month=${month}, year=${year}, half=${half}, found ${result.length} salaries`);
    }
    
    if (month && year && !week) {
      result = salaries.filter(s => Number(s.month) === Number(month) && Number(s.year) === Number(year));
      console.log(`Filtered by month=${month}, year=${year}, found ${result.length} salaries`);
    }
    
    if (paymentCycle && !week) {
      result = salaries.filter(s => s.paymentCycle === paymentCycle);
      console.log(`Filtered by paymentCycle=${paymentCycle}, found ${result.length} salaries`);
    }
    
    return result;
  } catch (error) {
    console.error('Error in get-salaries handler:', error);
    return [];
  }
});

ipcMain.handle('delete-salary', async (event, id) => {
  const salaries = store.get('salaries') || [];
  const newSalaries = salaries.filter(s => s.id !== id);
  store.set('salaries', newSalaries);
  return true;
});

// Employee report related IPC handlers
ipcMain.handle('generate-employee-report', async (event, { employeeId, includeSignature = true }) => {
  try {
    // Get employee data
    const employees = store.get('employees') || [];
    let employee;
    
    if (employeeId === 'all') {
      // Return all employees for a full report
      employee = employees;
    } else {
      // Find specific employee
      employee = employees.find(emp => emp.id === employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }
    }
    
    // Get salary data for the employee(s)
    const salaries = store.get('salaries') || [];
    let employeeSalaries;
    
    if (employeeId === 'all') {
      // Group salaries by employee
      employeeSalaries = {};
      employees.forEach(emp => {
        employeeSalaries[emp.id] = salaries.filter(s => s.employeeId === emp.id);
      });
    } else {
      // Get salaries for specific employee
      employeeSalaries = salaries.filter(s => s.employeeId === employeeId);
    }
    
    // Return report data
    return {
      employee,
      salaries: employeeSalaries,
      generatedAt: new Date().toISOString(),
      includeSignature
    };
  } catch (error) {
    console.error('Error generating employee report:', error);
    throw error;
  }
});

// Add missing handler for get-pending-shifts
ipcMain.handle('get-pending-shifts', async () => {
  // Return empty array as placeholder
  return [];
});

ipcMain.handle('generate-department-report', async () => {
  try {
    // Get all employees
    const employees = store.get('employees') || [];
    
    // Group employees by department
    const departmentData = {};
    
    employees.forEach(employee => {
      if (employee && employee.department) {
        const department = employee.department.trim();
        if (!departmentData[department]) {
          departmentData[department] = [];
        }
        departmentData[department].push(employee);
      }
    });
    
    return {
      departments: departmentData,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating department report:', error);
    throw error;
  }
});

// Attendance tracking handlers
ipcMain.handle('record-attendance', async (event, data) => {
  try {
    const { employeeId, type, timestamp, faceDetected } = data;
    const attendance = store.get('attendance') || [];
    
    // Create new attendance record
    const newRecord = {
      id: Date.now().toString(),
      employeeId,
      type, // 'in' or 'out'
      timestamp: timestamp || new Date().toISOString(),
      faceDetected: faceDetected || false
    };
    
    // Add to attendance records
    attendance.push(newRecord);
    store.set('attendance', attendance);
    
    // Update employee status based on attendance
    updateEmployeeStatus(employeeId);
    
    return newRecord;
  } catch (error) {
    console.error('Error recording attendance:', error);
    throw error;
  }
});

ipcMain.handle('get-employee-attendance', async (event, employeeId) => {
  try {
    const attendance = store.get('attendance') || [];
    return attendance.filter(record => record.employeeId === employeeId);
  } catch (error) {
    console.error('Error getting employee attendance:', error);
    throw error;
  }
});

ipcMain.handle('get-all-attendance', async () => {
  try {
    return store.get('attendance') || [];
  } catch (error) {
    console.error('Error getting all attendance records:', error);
    throw error;
  }
});

// Helper function to update employee status based on attendance
function updateEmployeeStatus(employeeId) {
  try {
    const employees = store.get('employees') || [];
    const attendance = store.get('attendance') || [];
    
    // Find the employee
    const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
    if (employeeIndex === -1) return;
    
    // Skip status update if employee is on leave
    if (employees[employeeIndex].status === 'onleave' || employees[employeeIndex].status === 'leave') {
      return;
    }
    
    // Get employee's attendance records, sorted by timestamp (newest first)
    const employeeAttendance = attendance
      .filter(record => record.employeeId === employeeId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // If no attendance records, don't change status
    if (employeeAttendance.length === 0) return;
    
    // Get the most recent record
    const latestRecord = employeeAttendance[0];
    
    // Check if the employee has clocked in today
    const today = new Date().toISOString().split('T')[0];
    const latestDate = new Date(latestRecord.timestamp).toISOString().split('T')[0];
    
    // Update status based on attendance type
    if (today === latestDate) {
      // If the latest record is a clock-in, set status to 'time in'
      if (latestRecord.type === 'in' || latestRecord.type === 'time-in' || latestRecord.type === 'clock-in' || latestRecord.type === 'clockin') {
        employees[employeeIndex].status = 'time in';
      } 
      // If the latest record is a clock-out, set status to 'inactive'
      else if (latestRecord.type === 'out' || latestRecord.type === 'time-out' || latestRecord.type === 'clock-out' || latestRecord.type === 'clockout') {
        employees[employeeIndex].status = 'inactive';
      }
    } else {
      // If no attendance today, set to 'inactive'
      employees[employeeIndex].status = 'inactive';
    }
    
    // Update employees in store
    store.set('employees', employees);
  } catch (error) {
    console.error('Error updating employee status:', error);
  }
}

// Handler to set employee on leave
ipcMain.handle('set-employee-onleave', async (event, employeeId) => {
  try {
    const employees = store.get('employees') || [];
    const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
    
    if (employeeIndex === -1) {
      return { success: false, message: 'Employee not found' };
    }
    
    // Set employee status to on leave
    employees[employeeIndex].status = 'onleave';
    employees[employeeIndex].leaveStartDate = new Date().toISOString();
    
    // Update employees in store
    store.set('employees', employees);
    
    return { 
      success: true, 
      message: `Employee ${employees[employeeIndex].name} has been set to on leave`,
      employee: employees[employeeIndex]
    };
  } catch (error) {
    console.error('Error setting employee on leave:', error);
    return { success: false, message: error.message };
  }
});

// Handler to remove employee from leave status
ipcMain.handle('remove-employee-from-leave', async (event, employeeId) => {
  try {
    const employees = store.get('employees') || [];
    const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
    
    if (employeeIndex === -1) {
      return { success: false, message: 'Employee not found' };
    }
    
    // Remove leave status and reset to inactive
    employees[employeeIndex].status = 'inactive';
    employees[employeeIndex].leaveEndDate = new Date().toISOString();
    
    // Update employees in store
    store.set('employees', employees);
    
    return { 
      success: true, 
      message: `Employee ${employees[employeeIndex].name} has been removed from leave status`,
      employee: employees[employeeIndex]
    };
  } catch (error) {
    console.error('Error removing employee from leave:', error);
    return { success: false, message: error.message };
  }
});

// Backup and Restore handlers
ipcMain.handle('export-backup', async () => {
  try {
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Backup',
      defaultPath: `payroll-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, message: 'Export cancelled' };
    }

    // Collect all data from the store
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        employees: store.get('employees') || [],
        payheads: store.get('payheads') || [],
        salaries: store.get('salaries') || [],
        attendance: store.get('attendance') || [],
        companySettings: {
          name: store.get('company-name') || '',
          address: store.get('company-address') || '',
          email: store.get('company-email') || '',
          phone: store.get('company-phone') || ''
        },
        appSettings: {
          currencySymbol: store.get('currency-symbol') || '₱',
          dateFormat: store.get('date-format') || 'MM/DD/YYYY',
          darkMode: store.get('dark-mode') || false
        }
      }
    };

    // Write backup file
    const fs = require('fs');
    fs.writeFileSync(result.filePath, JSON.stringify(backupData, null, 2));

    return { 
      success: true, 
      message: `Backup exported successfully to ${result.filePath}`,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('Error exporting backup:', error);
    return { 
      success: false, 
      message: `Export failed: ${error.message}` 
    };
  }
});

// Return a backup snapshot (without saving to a file)
ipcMain.handle('get-backup-snapshot', async () => {
  try {
    const snapshot = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        employees: store.get('employees') || [],
        payheads: store.get('payheads') || [],
        salaries: store.get('salaries') || [],
        attendance: store.get('attendance') || [],
        companySettings: {
          name: store.get('company-name') || '',
          address: store.get('company-address') || '',
          email: store.get('company-email') || '',
          phone: store.get('company-phone') || ''
        },
        appSettings: {
          currencySymbol: store.get('currency-symbol') || '₱',
          dateFormat: store.get('date-format') || 'MM/DD/YYYY',
          darkMode: store.get('dark-mode') || false
        }
      }
    };
    return { success: true, snapshot };
  } catch (error) {
    console.error('Error building backup snapshot:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('import-backup', async (event, filePath) => {
  try {
    const fs = require('fs');
    
    // Read and parse backup file
    const backupContent = fs.readFileSync(filePath, 'utf8');
    const backupData = JSON.parse(backupContent);

    // Validate backup format
    if (!backupData.version || !backupData.data) {
      throw new Error('Invalid backup file format');
    }

    // Show confirmation dialog
    const confirmResult = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Import', 'Cancel'],
      defaultId: 1,
      title: 'Confirm Import',
      message: 'Import Backup Data',
      detail: 'This will replace ALL current data with the backup data. This action cannot be undone. Are you sure you want to continue?'
    });

    if (confirmResult.response !== 0) {
      return { success: false, message: 'Import cancelled' };
    }

    // Import data to store
    const data = backupData.data;
    
    // Import main data
    if (data.employees) store.set('employees', data.employees);
    if (data.payheads) store.set('payheads', data.payheads);
    if (data.salaries) store.set('salaries', data.salaries);
    if (data.attendance) store.set('attendance', data.attendance);
    
    // Import company settings
    if (data.companySettings) {
      if (data.companySettings.name) store.set('company-name', data.companySettings.name);
      if (data.companySettings.address) store.set('company-address', data.companySettings.address);
      if (data.companySettings.email) store.set('company-email', data.companySettings.email);
      if (data.companySettings.phone) store.set('company-phone', data.companySettings.phone);
    }
    
    // Import app settings
    if (data.appSettings) {
      if (data.appSettings.currencySymbol) store.set('currency-symbol', data.appSettings.currencySymbol);
      if (data.appSettings.dateFormat) store.set('date-format', data.appSettings.dateFormat);
      if (data.appSettings.darkMode !== undefined) store.set('dark-mode', data.appSettings.darkMode);
    }

    // After restore: enqueue employee sync operations so Supabase reflects imported data
    try {
      const employees = store.get('employees') || [];
      const queue = store.get('pendingSync') || [];
      for (const emp of employees) {
        const op = {
          id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
          type: 'employee',
          action: 'update',
          payload: emp,
          timestamp: new Date().toISOString()
        };
        queue.push(op);
      }
      store.set('pendingSync', queue);
      console.log(`Enqueued ${employees.length} employee operations for Supabase sync after restore`);
    } catch (e) {
      console.error('Failed to enqueue sync after restore:', e);
    }

    return { 
      success: true, 
      message: `Backup imported successfully from ${filePath}. Please restart the application to see all changes.`,
      requiresRestart: true
    };
  } catch (error) {
    console.error('Error importing backup:', error);
    return { 
      success: false, 
      message: `Import failed: ${error.message}` 
    };
  }
});

function create2FAWindow() {
    twofaWindow = new BrowserWindow({
        width: 800,
        height: 600,
        fullscreen: true,
        webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
},
        resizable: false,
        frame: false,
    });
    twofaWindow.loadFile(path.join(__dirname, 'src/twofa.html'));
    twofaWindow.on('closed', () => { twofaWindow = null; });
}

let twofaSecret = store.get('twofa-secret');
if (!twofaSecret) {
  twofaSecret = speakeasy.generateSecret({ length: 20, name: 'Payroll System 2FA' });
  store.set('twofa-secret', twofaSecret);
}

ipcMain.handle('get-2fa-setup', async () => {
  try {
    const isVerified = !!store.get('twofa-verified');
    if (isVerified) {
      return { qrDataUrl: null, secret: null, shown: false };
    }
    const otpauth_url = twofaSecret.otpauth_url;
    const qrDataUrl = await qrcode.toDataURL(otpauth_url);
    return { qrDataUrl, secret: twofaSecret.base32, shown: true };
  } catch (e) {
    console.error('Error generating 2FA setup:', e);
    return { qrDataUrl: null, secret: null, shown: false };
  }
});

ipcMain.handle('verify-2fa', (event, code) => {
  const verified = speakeasy.totp.verify({
    secret: twofaSecret.base32,
    encoding: 'base32',
    token: code,
    window: 1
  });
  if (verified) {
    store.set('twofa-verified', true);
  }
  return { success: verified };
});

ipcMain.on('2fa-success', () => {
  if (twofaWindow) twofaWindow.close();
  createWindow();
});

app.whenReady().then(() => {
  create2FAWindow();

  app.on('activate', function () {
    if (mainWindow === null && twofaWindow === null) create2FAWindow();
  });
});

// Handle logout from renderer: close main window and show 2FA screen
ipcMain.on('logout', () => {
  try {
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    // Re-open the 2FA window
    if (!twofaWindow) {
      create2FAWindow();
    }
  } catch (err) {
    console.error('Error handling logout:', err);
  }
});

// Restore local store from provided snapshot object
ipcMain.handle('restore-from-snapshot', async (event, snapshot) => {
  try {
    const data = snapshot && snapshot.data ? snapshot.data : snapshot;
    if (!data) {
      throw new Error('Invalid snapshot payload');
    }

    // Import main data
    if (data.employees) store.set('employees', data.employees);
    if (data.payheads) store.set('payheads', data.payheads);
    if (data.salaries) store.set('salaries', data.salaries);
    if (data.attendance) store.set('attendance', data.attendance);

    // Import company settings
    if (data.companySettings) {
      if (data.companySettings.name) store.set('company-name', data.companySettings.name);
      if (data.companySettings.address) store.set('company-address', data.companySettings.address);
      if (data.companySettings.email) store.set('company-email', data.companySettings.email);
      if (data.companySettings.phone) store.set('company-phone', data.companySettings.phone);
    }

    // Import app settings
    if (data.appSettings) {
      if (data.appSettings.currencySymbol) store.set('currency-symbol', data.appSettings.currencySymbol);
      if (data.appSettings.dateFormat) store.set('date-format', data.appSettings.dateFormat);
      if (data.appSettings.darkMode !== undefined) store.set('dark-mode', data.appSettings.darkMode);
    }

    // After restore: enqueue employee sync operations for Supabase
    try {
      const employees = store.get('employees') || [];
      const queue = store.get('pendingSync') || [];
      for (const emp of employees) {
        const op = {
          id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
          type: 'employee',
          action: 'update',
          payload: emp,
          timestamp: new Date().toISOString()
        };
        queue.push(op);
      }
      store.set('pendingSync', queue);
      console.log(`Enqueued ${employees.length} employee operations for Supabase sync after snapshot restore`);
    } catch (e) {
      console.error('Failed to enqueue sync after snapshot restore:', e);
    }

    return { success: true, message: 'Snapshot restored successfully', requiresRestart: true };
  } catch (error) {
    console.error('Error restoring from snapshot:', error);
    return { success: false, message: `Restore failed: ${error.message}` };
  }
});