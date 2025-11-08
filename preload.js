const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  print: () => ipcRenderer.send('print')
});
contextBridge.exposeInMainWorld('api', {
  // 2FA APIs
  get2FASetup: () => ipcRenderer.invoke('get-2fa-setup'),
  verify2FA: (code) => ipcRenderer.invoke('verify-2fa', code),
  send2FASuccess: () => ipcRenderer.send('2fa-success'),
   // Logout
  logout: () => ipcRenderer.send('logout'),
  // Employee operations
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  addEmployee: (employee) => ipcRenderer.invoke('add-employee', employee),
  updateEmployee: (employee) => ipcRenderer.invoke('update-employee', employee),
  deleteEmployee: (id) => ipcRenderer.invoke('delete-employee', id),
  onEmployeeDeleted: (callback) => ipcRenderer.on('employee-deleted', callback),
  onEmployeeAdded: (callback) => ipcRenderer.on('employee-added', callback),
  // Salary events for real-time dashboard update
  onSalaryGenerated: (callback) => ipcRenderer.on('salary-generated', callback),
  onSalaryDeleted: (callback) => ipcRenderer.on('salary-deleted', callback),
  updateEmployeeSignature: (employeeId, signatureData) => ipcRenderer.invoke('update-employee-signature', { employeeId, signatureData }),
  getEmployee: (id) => ipcRenderer.invoke('get-employee', id),
  // Payhead operations
  getPayheads: () => ipcRenderer.invoke('get-payheads'),
  addPayhead: (payhead) => ipcRenderer.invoke('add-payhead', payhead),
  updatePayhead: (payhead) => ipcRenderer.invoke('update-payhead', payhead),
  deletePayhead: (id) => ipcRenderer.invoke('delete-payhead', id),
  
  // Salary operations
  generateSalary: (data) => ipcRenderer.invoke('generate-salary', data),
  getSalaries: (filters) => ipcRenderer.invoke('get-salaries', filters),
  deleteSalary: (id) => ipcRenderer.invoke('delete-salary', id),
  
  // Report operations
  generateEmployeeReport: (options) => ipcRenderer.invoke('generate-employee-report', options),
  generateDepartmentReport: () => ipcRenderer.invoke('generate-department-report'),
  
  // Attendance operations
  recordAttendance: (data) => ipcRenderer.invoke('record-attendance', data),
  getEmployeeAttendance: (employeeId) => ipcRenderer.invoke('get-employee-attendance', employeeId),
  getAllAttendance: () => ipcRenderer.invoke('get-all-attendance'),
  getPendingShifts: () => ipcRenderer.invoke('get-pending-shifts'),
  
  // Leave management operations
  setEmployeeOnLeave: (employeeId) => ipcRenderer.invoke('set-employee-onleave', employeeId),
  removeEmployeeFromLeave: (employeeId) => ipcRenderer.invoke('remove-employee-from-leave', employeeId),
  
  // Backup and Restore operations
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: (filePath) => ipcRenderer.invoke('import-backup', filePath),
  // Snapshot operations for cloud backup
  getBackupSnapshot: () => ipcRenderer.invoke('get-backup-snapshot'),
  restoreFromSnapshot: (snapshot) => ipcRenderer.invoke('restore-from-snapshot', snapshot),

  // Offline Sync Queue operations
  enqueueSync: (operation) => ipcRenderer.invoke('enqueue-sync', operation),
  getPendingSync: () => ipcRenderer.invoke('get-pending-sync'),
  markSyncComplete: (id) => ipcRenderer.invoke('mark-sync-complete', id),
});