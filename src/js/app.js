// Main Application JavaScript for Electron Payroll

// Supabase initialization
const supabase = window.supabase.createClient(
  'https://qhlxuelyhytknfeoflsn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobHh1ZWx5aHl0a25mZW9mbHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjA4MzksImV4cCI6MjA3NDI5NjgzOX0.iqRp6kbvkAP0LqYyx7GVwipMDElzLrU0gktGk4NTwrk'
);
window.supabase = supabase;
async function deleteEmployee(employeeId) {
  const { data, error } = await supabase
    .from('employees')
    .delete()
    .eq('id', employeeId);

  if (error) {
    console.error('Error deleting employee:', error.message);
    showNotification('Error deleting employee: ' + error.message, 'danger');
    return false;
  } else {
    console.log('Employee deleted:', data);
    showNotification('Employee deleted successfully!', 'success');
    return true;
  }
}

let departmentChartInstance = null;
let salaryChartInstance = null;
// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {

  
  // Initialize navigation
  initNavigation();
  
  // Initialize dashboard
  loadDashboardData();
  
  // Initialize employees section
  loadEmployees();
  
  // Initialize payheads section
  loadPayheads();
  
  // Initialize salary section
  loadSalaries();
  initYearDropdowns();
  
  // Initialize event listeners
  initEventListeners();

  // Network status handlers
  if (!navigator.onLine) {
    showNotification('You are offline. Changes will sync when online.', 'warning');
  }
  window.addEventListener('online', () => {
    showNotification('Back online. Syncing pending changes...', 'info');
    processPendingSync();
  });
  window.addEventListener('offline', () => {
    showNotification('You are offline. Changes will sync when online.', 'warning');
  });

  // Attempt to process any pending sync at startup if online
  if (navigator.onLine) {
    processPendingSync();
  }
});

// Initialize navigation between sections
function initNavigation() {
  // Get all navigation links
  const navLinks = document.querySelectorAll('#sidebar ul li a');
  
  // Add click event to each navigation link
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all links
      navLinks.forEach(l => l.parentElement.classList.remove('active'));
      
      // Add active class to clicked link
      this.parentElement.classList.add('active');
      
      // Get the section id from the link id
      const sectionId = this.id.replace('nav-', '') + '-section';
      
      // Hide all sections
      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
      
      // Show the selected section
      document.getElementById(sectionId).classList.add('active');
      
      // Update page title
      document.getElementById('page-title').textContent = this.textContent;
    });
  });
  
  // Toggle sidebar
  document.getElementById('sidebarCollapse').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('active');
  });
}

// Initialize year dropdowns for salary sections
function initYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const yearDropdowns = document.querySelectorAll('#salary-year, #salary-gen-year');
  
  yearDropdowns.forEach(dropdown => {
    // Clear existing options
    dropdown.innerHTML = '';
    
    // Add options for current year and 4 previous years
    for (let year = currentYear; year >= currentYear - 4; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      dropdown.appendChild(option);
    }
  });
}

// Initialize event listeners
function initEventListeners() {
  // Admin dropdown toggle
  const adminDropdownBtn = document.getElementById('adminDropdownBtn');
  const adminDropdownContent = document.getElementById('adminDropdownContent');
  
  if (adminDropdownBtn && adminDropdownContent) {
    // Toggle dropdown when clicking the button
    adminDropdownBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      adminDropdownContent.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.matches('.admin-dropdown-btn') && !e.target.matches('.admin-dropdown-btn *')) {
        if (adminDropdownContent.classList.contains('show')) {
          adminDropdownContent.classList.remove('show');
        }
      }
    });
    
    // Logout button functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Close the dropdown
        adminDropdownContent.classList.remove('show');
        // Trigger logout via main process
        if (window.api && typeof window.api.logout === 'function') {
          window.api.logout();
        } else {
          // Fallback: redirect to 2FA page directly when running outside Electron
          try {
            window.location.href = 'twofa.html';
          } catch (err) {
            console.error('Logout fallback error:', err);
          }
        }
      });
    }
  }
  
  // Filter dropdowns removed as requested
  
  // Filter dropdowns code removed as requested
  
  // Employee modal events
  const addEmployeeBtn = document.getElementById('add-employee-btn');
  if (addEmployeeBtn) addEmployeeBtn.addEventListener('click', showAddEmployeeModal);
  
  // Backup and Restore events
  const exportBackupBtn = document.getElementById('export-backup-btn');
  const importBackupBtn = document.getElementById('import-backup-btn');
  const importBackupFile = document.getElementById('import-backup-file');
  const exportCloudBackupBtn = document.getElementById('export-cloud-backup-btn');
  const importCloudBackupBtn = document.getElementById('import-cloud-backup-btn');
  
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', handleExportBackup);
  }
  if (exportCloudBackupBtn) {
    exportCloudBackupBtn.addEventListener('click', handleExportCloudBackup);
  }
  
  if (importBackupBtn && importBackupFile) {
    importBackupBtn.addEventListener('click', function() {
      importBackupFile.click();
    });
    
    importBackupFile.addEventListener('change', handleImportBackup);
  }
  if (importCloudBackupBtn) {
    importCloudBackupBtn.addEventListener('click', handleImportCloudBackup);
  }
  
  // Add debounce to employee form inputs to prevent lag when typing
  const employeeInputs = [
    'employee-name',
    'employee-email',
    'employee-phone',
    'employee-department',
    'employee-designation',
    'employee-basic-salary'
  ];
  
  // Apply debounce to each input field
  employeeInputs.forEach(inputId => {
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
      // Remove any existing input event listeners to prevent duplicates
      // const newInputElement = inputElement.cloneNode(true);
      // inputElement.parentNode.replaceChild(newInputElement, inputElement);
      // Instead of replacing, just remove all event listeners by setting inputElement.oninput = null
      inputElement.oninput = null;
      // Optionally, re-add debounce or other listeners here if needed
    }
  });
  
  // Listen for employee deleted event from main process
  if (window.api && typeof window.api.onEmployeeDeleted === 'function') {
    window.api.onEmployeeDeleted(() => {
      loadEmployees();
      loadDashboardData();
    });
  }
  
  // Listen for employee added event from main process
  if (window.api && typeof window.api.onEmployeeAdded === 'function') {
    window.api.onEmployeeAdded(() => {
      loadEmployees();
      loadDashboardData();
    });
  }

  // Listen for salary generated event from main process
  if (window.api && typeof window.api.onSalaryGenerated === 'function') {
    window.api.onSalaryGenerated(() => {
      loadDashboardData();
    });
  }

  // Listen for salary deleted event from main process
  if (window.api && typeof window.api.onSalaryDeleted === 'function') {
    window.api.onSalaryDeleted(() => {
      loadDashboardData();
    });
  }
  
  // Payhead modal events
  const addPayheadBtn = document.getElementById('add-payhead-btn');
  if (addPayheadBtn) addPayheadBtn.addEventListener('click', showAddPayheadModal);
  const savePayheadBtn = document.getElementById('save-payhead-btn');
  if (savePayheadBtn) savePayheadBtn.addEventListener('click', savePayhead);
  const payheadValueTypeSelect = document.getElementById('payhead-value-type');
  if (payheadValueTypeSelect) payheadValueTypeSelect.addEventListener('change', updatePayheadValueTypeUI);
  
  // Salary generation events
  const generateSalaryBtn = document.getElementById('generate-salary-btn');
  if (generateSalaryBtn) generateSalaryBtn.addEventListener('click', showGenerateSalaryModal);
  const saveSalaryBtn = document.getElementById('save-salary-btn');
  if (saveSalaryBtn) saveSalaryBtn.addEventListener('click', generateSalary);
  const filterSalaryBtn = document.getElementById('filter-salary-btn');
  if (filterSalaryBtn) filterSalaryBtn.addEventListener('click', filterSalaries);
  
  // Report generation events
  const employeeReportBtn = document.getElementById('employee-report-btn');
  if (employeeReportBtn) employeeReportBtn.addEventListener('click', showEmployeeReportModal);
  const salaryReportBtn = document.getElementById('salary-report-btn');
  if (salaryReportBtn) salaryReportBtn.addEventListener('click', showSalaryReportModal);
  const departmentReportBtn = document.getElementById('department-report-btn');
  if (departmentReportBtn) departmentReportBtn.addEventListener('click', generateDepartmentReport);
  const generateEmployeeReportBtn = document.getElementById('generate-employee-report-btn');
  if (generateEmployeeReportBtn) generateEmployeeReportBtn.addEventListener('click', function() {
    const employeeId = document.getElementById('report-employee-select').value;
    generateEmployeeReport(employeeId);
  });
  const generateSalaryReportBtn = document.getElementById('generate-salary-report-btn');
  if (generateSalaryReportBtn) generateSalaryReportBtn.addEventListener('click', generateSalaryReport);
  const printEmployeeReportBtn = document.getElementById('print-employee-report-btn');
  if (printEmployeeReportBtn) printEmployeeReportBtn.addEventListener('click', printReport);
  const printDepartmentReportBtn = document.getElementById('print-department-report-btn');
  if (printDepartmentReportBtn) printDepartmentReportBtn.addEventListener('click', printReport);
  const printSalaryReportBtn = document.getElementById('print-salary-report-btn');
  if (printSalaryReportBtn) printSalaryReportBtn.addEventListener('click', printReport);
  
  // Settings form events
  const companyForm = document.getElementById('company-form');
  if (companyForm) companyForm.addEventListener('submit', saveCompanySettings);
  const appSettingsForm = document.getElementById('app-settings-form');
  if (appSettingsForm) appSettingsForm.addEventListener('submit', saveAppSettings);
  
  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode');
  if (darkModeToggle) darkModeToggle.addEventListener('change', toggleDarkMode);
  
  // Print preview functionality has been removed

  // Bulk delete selected salaries
  const bulkDeleteBtn = document.getElementById('delete-selected-salaries-btn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', deleteSelectedSalaries);
  }

  // Bulk print selected salaries
  const bulkPrintBtn = document.getElementById('print-selected-salaries-btn');
  if (bulkPrintBtn) {
    bulkPrintBtn.addEventListener('click', bulkPrintSelectedSalaries);
  }
  
  // Load saved settings
  loadSettings();
}

// Load dashboard data and initialize charts
async function loadDashboardData() {
  try {
    // Get data from the main process
    const employees = await window.api.getEmployees();
    const payheads = await window.api.getPayheads();
    const salaries = await window.api.getSalaries();
    const pendingShifts = await window.api.getPendingShifts(); // Get pending shifts
    
    // Validate data
    if (!Array.isArray(employees)) {
      throw new Error('Invalid employees data received');
    }
    if (!Array.isArray(payheads)) {
      throw new Error('Invalid payheads data received');
    }
    if (!Array.isArray(salaries)) {
      throw new Error('Invalid salaries data received');
    }
    
    // Update dashboard counters - with null checks
    const totalEmployeesEl = document.getElementById('total-employees');
    const totalPayheadsEl = document.getElementById('total-payheads');
    const totalSalariesEl = document.getElementById('total-salaries');
    const totalAmountEl = document.getElementById('total-amount');
    const generatedPayslipEl = document.getElementById('generated-payslip');

// Update total employees count (all employees, not just active)
if (totalEmployeesEl) totalEmployeesEl.textContent = employees.length;
if (totalPayheadsEl) totalPayheadsEl.textContent = payheads.length;
if (totalSalariesEl) totalSalariesEl.textContent = salaries.length;

// Update generated payslips count
if (generatedPayslipEl) {
  generatedPayslipEl.textContent = Array.isArray(salaries) ? salaries.length : 0;
}
    
    // Calculate total salary amount for all generated salaries
    const totalAmount = salaries.reduce((sum, salary) => {
      // Ensure netSalary is a valid number
      const netSalaryAmount = parseFloat(salary.netSalary) || 0;
      return sum + netSalaryAmount;
    }, 0);
    
    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalAmount);
    
    // Initialize charts only if we have data and chart elements exist
    try {
      if (salaries.length > 0) {
        initSalaryChart(salaries);
      } else {
        // If no salary data, initialize empty chart
        initEmptySalaryChart();
      }
    } catch (chartError) {
      console.error('Error initializing salary chart:', chartError);
    }
    
    try {
      if (employees.length > 0) {
        initDepartmentChart(employees);
      } else {
        // If no employee data, initialize empty chart
        initEmptyDepartmentChart();
      }
    } catch (chartError) {
      console.error('Error initializing department chart:', chartError);
    }
  } catch (error) {
    showNotification('Error loading dashboard data: ' + error.message, 'danger');
    console.error('Dashboard data error:', error);
    
    // Initialize empty charts on error
    initEmptySalaryChart();
    initEmptyDepartmentChart();
  }
}

// Initialize salary distribution chart
function initSalaryChart(salaries) {
  try {
    const ctx = document.getElementById('salary-chart').getContext('2d');
    if (salaryChartInstance) {
      salaryChartInstance.destroy();
    }
    // Group salaries by month
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((month, index) => {
      monthlyData[index + 1] = 0;
    });
    if (Array.isArray(salaries)) {
      salaries.forEach(salary => {
        if (salary && salary.month && monthlyData.hasOwnProperty(salary.month)) {
          const netSalaryAmount = parseFloat(salary.netSalary) || 0;
          monthlyData[salary.month] += netSalaryAmount;
        }
      });
    }
    salaryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Salary Distribution',
          data: Object.values(monthlyData),
          backgroundColor: 'rgba(23, 66, 59, 0.5)',
          borderColor: 'rgba(23, 66, 59, 1)',
          borderWidth: 1
        }]
      },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            family: 'Tahoma, Geneva, Verdana, sans-serif',
            size: 14
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
    });
  } catch (error) {
    console.error('Error initializing salary chart:', error);
    initEmptySalaryChart();
  }
}

// Initialize empty salary chart when no data is available
function initEmptySalaryChart() {
  try {
    const ctx = document.getElementById('salary-chart').getContext('2d');
    if (salaryChartInstance) {
      salaryChartInstance.destroy();
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    salaryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Salary Distribution',
          data: Array(12).fill(0),
          backgroundColor: 'rgba(0, 123, 255, 0.5)',
          borderColor: 'rgba(0, 123, 255, 1)',
          borderWidth: 1
        }]
      },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            family: 'Tahoma, Geneva, Verdana, sans-serif',
            size: 14
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
    });
  } catch (error) {
    console.error('Error initializing empty salary chart:', error);
  }
}

// Initialize department distribution chart
function initDepartmentChart(employees) {
  try {
    const ctx = document.getElementById('department-chart').getContext('2d');
    if (!ctx) {
      console.error('Could not get department chart context');
      return;
    }
    // Destroy previous chart instances
    if (window.departmentChart) {
      window.departmentChart.destroy();
    }
    if (departmentChartInstance) {
      departmentChartInstance.destroy();
    }

    // Group employees by department
    const departmentCounts = {};
    employees.forEach(employee => {
      const dept = employee.department || 'Unassigned';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });
    const labels = Object.keys(departmentCounts);
    const data = Object.values(departmentCounts);
    const backgroundColors = [
      '#17423B', '#2E8B57', '#4682B4', '#FFD700', '#FF6347', '#6A5ACD', '#20B2AA', '#FFB6C1', '#A0522D', '#7FFF00', '#DC143C', '#00CED1', '#FF8C00', '#8A2BE2', '#B8860B'
    ];
    // Repeat colors if not enough
    while (backgroundColors.length < labels.length) {
      backgroundColors.push(...backgroundColors);
    }
    departmentChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                family: 'Tahoma, Geneva, Verdana, sans-serif',
                size: 14
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value}`;
              }
            }
          }
        }
      }
    });
    window.departmentChart = departmentChartInstance;
  } catch (error) {
    console.error('Error initializing department chart:', error);
    initEmptyDepartmentChart();
  }
}

// Initialize empty department chart when no data is available
function initEmptyDepartmentChart() {
  try {
    const ctx = document.getElementById('department-chart').getContext('2d');
    if (departmentChartInstance) {
      departmentChartInstance.destroy();
    }
    departmentChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(200, 200, 200, 0.7)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  } catch (error) {
    console.error('Error initializing empty department chart:', error);
  }
}

// Load employees data
async function loadEmployees() {
    // Fetch all attendance records for badge logic
    let attendanceData = [];
    if (window.fetchAttendanceData) {
        attendanceData = await window.fetchAttendanceData();
    } else if (window.supabase && window.supabase.from) {
        const { data } = await window.supabase.from('attendance').select('*').order('timestamp', { ascending: false });
        attendanceData = data || [];
    }
    // Helper: Get latest attendance record for a given name
    function getLatestAttendanceByName(name) {
        if (!attendanceData) return null;
        const records = attendanceData.filter(record => record.user_name === name);
        if (records.length === 0) return null;
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return records[0];
    }

    try {
        const employees = await window.api.getEmployees();
        const tableBody = document.getElementById('employees-list');

        // Update department dropdown with dynamic departments
        updateDepartmentDropdown(employees);
        // Also update Add/Edit employee department datalist for suggestions
        updateDepartmentDatalist(employees);

        if (!tableBody) {
            console.error('Employee list table body not found');
            return;
        }

        // Clear existing rows
        tableBody.innerHTML = '';

        // Count employee statuses
        let activeCount = 0;
        let inactiveCount = 0;
        let leaveCount = 0;

        // Add employee rows to table and update counts
    employees.forEach(employee => {
        if (!employee) return; // Skip null or undefined employees

        const row = document.createElement('tr');

        // Determine status based on latest attendance record, but preserve on leave status
        let status = employee.status || 'inactive'; // Use existing status if available
        
        // Only update status based on attendance if employee is not on leave
        if (status !== 'onleave' && status !== 'leave') {
            status = 'inactive'; // Default to inactive
            const latestAttendance = getLatestAttendanceByName(employee.name);
            if (latestAttendance) {
                const today = new Date().toISOString().slice(0, 10);
                const attendanceDate = new Date(latestAttendance.timestamp).toISOString().slice(0, 10);
                // Accept multiple possible clock-in types
                const clockInTypes = ['clock-in', 'in', 'time-in', 'clockin'];
                const clockOutTypes = ['clock-out', 'out', 'time-out', 'clockout'];
                if (attendanceDate === today && clockInTypes.includes(latestAttendance.type)) {
                    status = 'time in';
                } else if (attendanceDate === today && clockOutTypes.includes(latestAttendance.type)) {
                    status = 'inactive';
                }
            }
        }

        // Count by status
        if (status === 'time in') activeCount++;
        else if (status === 'inactive') inactiveCount++;
        else if (status === 'onleave' || status === 'leave') leaveCount++;

        // Create status badge class based on status
        const statusClass = status === 'time in' ? 'status-active' :
                            status === 'inactive' ? 'status-inactive' : 'status-leave';

        // Render row
        row.innerHTML = `
            <td>${employee.id || ''}</td>
            <td>${employee.name || ''}</td>
            <td>${employee.department || ''}</td>
            <td>${employee.designation || ''}</td>
            <td><span class="status-badge ${statusClass}">${status === 'time in' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn history-btn view-attendance-history" data-id="${employee.id}" data-name="${employee.name}" title="View Attendance History"><i class="fas fa-history"></i></button>
                    <button class="action-btn leave-btn set-employee-onleave ${status === 'onleave' ? 'on-leave-active' : ''}" data-id="${employee.id}" data-status="${status}" title="${status === 'onleave' ? 'Remove from Leave' : 'Set On Leave'}"><i class="fas ${status === 'onleave' ? 'fa-check' : 'fa-plane'}"></i></button>
                    <button class="action-btn edit-btn edit-employee" data-id="${employee.id}" title="Edit Employee"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn delete-employee" data-id="${employee.id}" title="Delete Employee"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

        // Update the employee status counts
        updateEmployeeStats(employees.length, activeCount, inactiveCount, leaveCount);

        console.log(`Loaded ${employees.length} employees into table`);

        // Add event listeners to attendance history, edit and delete buttons
        document.querySelectorAll('.view-attendance-history').forEach(button => {
            button.addEventListener('click', function () {
                const employeeId = this.getAttribute('data-id');
                const employeeName = this.getAttribute('data-name');
                showAttendanceHistory(employeeId, employeeName, employees);
            });
        });

        document.querySelectorAll('.edit-employee').forEach(button => {
            button.addEventListener('click', function () {
                const employeeId = this.getAttribute('data-id');
                editEmployee(employeeId, employees);
            });
        });

        document.querySelectorAll('.delete-employee').forEach(button => {
            button.addEventListener('click', function () {
                const employeeId = this.getAttribute('data-id');
                deleteEmployee(employeeId);
            });
        });

        document.querySelectorAll('.set-employee-onleave').forEach(button => {
            button.addEventListener('click', function () {
                const employeeId = this.getAttribute('data-id');
                const employeeName = this.closest('tr').querySelector('td:nth-child(2)').textContent;
                const currentStatus = this.getAttribute('data-status');
                if (currentStatus === 'onleave') {
                    removeEmployeeFromLeave(employeeId, employeeName);
                } else {
                    setEmployeeOnLeave(employeeId, employeeName);
                }
            });
        });
    } catch (error) {
        showNotification('Error loading employees', 'danger');
        console.error('Employees error:', error);
    }
}

// Global variable to store the current signature pad instance
let currentSignaturePad = null;

// Show add employee modal
function showAddEmployeeModal() {
  // Reset form
  document.getElementById('employee-form').reset();
  document.getElementById('employee-id').value = '';
  document.getElementById('employee-signature-data').value = '';
  document.getElementById('employeeModalLabel').textContent = 'Add Employee';
  
  // Optimize form inputs to prevent lag when typing
  const inputFields = [
    'employee-name',
    'employee-email',
    'employee-phone',
    'employee-department',
    'employee-designation',
    'employee-basic-salary'
  ];
  inputFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      const newField = field.cloneNode(true);
      field.parentNode.replaceChild(newField, field);
      newField.addEventListener('input', debounce(function(e) {}, 300));
    }
  });
  
  // Attach numeric enforcement for TIN and PhilHealth
  attachNumericIdListeners();

  // Populate department suggestions from existing employees
  try {
    if (window.api && window.api.getEmployees) {
      window.api.getEmployees().then(updateDepartmentDatalist).catch(() => updateDepartmentDatalist([]));
    } else {
      // Fallback in non-Electron preview
      updateDepartmentDatalist([]);
    }
  } catch (_) { updateDepartmentDatalist([]); }
  // Initialize Position suggestions (static list)
  initPositionSuggestions();
  
  // Clear signature preview
  const signaturePreview = document.getElementById('signature-preview');
  if (signaturePreview) {
    signaturePreview.src = '';
    signaturePreview.classList.remove('has-signature');
  }
  
  // Remove any existing event handlers to prevent duplicates
  $('#employee-modal').off('shown.bs.modal');

  // Ensure save button always works
  const saveBtn = document.getElementById('save-employee-btn');
  if (saveBtn) {
    // Remove old event listeners by cloning (do not copy inline handlers)
    const newSaveBtn = saveBtn.cloneNode(false);
    // Preserve visible label
    newSaveBtn.textContent = saveBtn.textContent || 'Save';
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    // Ensure no inline onclick remains
    newSaveBtn.onclick = null;
    // Add event listener to the new button
    newSaveBtn.addEventListener('click', saveEmployee);
  }

  // Show modal
  $('#employee-modal').modal('show');
  
  // Initialize signature pad after modal is shown to ensure canvas is visible
  $('#employee-modal').on('shown.bs.modal', function() {
    currentSignaturePad = initSignaturePad();
    // Explicitly focus the first input field for reliability
    const firstInput = document.getElementById('employee-name');
    if (firstInput) {
      firstInput.focus();
    }
  });
}

// Optimize employee form inputs to prevent lag when typing
function optimizeEmployeeFormInputs() {
  // List of input fields in the employee form
  const inputFields = [
    'employee-name',
    'employee-email',
    'employee-phone',
    'employee-department',
    'employee-designation',
    'employee-basic-salary'
  ];
  // Apply optimization to each input field
  inputFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      // Remove any existing input event listeners by setting oninput to null
      field.oninput = null;
      // Add optimized event handling with debouncing
      field.addEventListener('input', debounce(function(e) {
        // The debounced handler will only run after typing has paused
        // No processing needed here, just preventing lag
      }, 300));
    }
  });
}

// Enforce numeric-only and length constraints for TIN (9) and PhilHealth (12)
function attachNumericIdListeners() {
  const tin = document.getElementById('employee-tin');
  if (tin) {
    // Clone to remove any previous listeners
    const newTin = tin.cloneNode(true);
    tin.parentNode.replaceChild(newTin, tin);
    newTin.addEventListener('input', function() {
      const raw = newTin.value.trim();
      if (/^n\/a$/i.test(raw)) {
        newTin.value = 'N/A';
        return;
      }
      const digits = raw.replace(/\D/g, '');
      newTin.value = digits.slice(0, 12);
    });
    newTin.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/^n\/a$/i.test(String(text).trim())) {
        newTin.value = 'N/A';
        return;
      }
      newTin.value = String(text).replace(/\D/g, '').slice(0, 12);
    });
    // Auto-fill to 'N/A' when left blank on blur
    newTin.addEventListener('blur', function() {
      if ((newTin.value || '').trim() === '') {
        newTin.value = 'N/A';
      }
    });
  }

  // Telephone Number: 9 digits
  const phone = document.getElementById('employee-phone');
  if (phone) {
    const newPhone = phone.cloneNode(true);
    phone.parentNode.replaceChild(newPhone, phone);
    newPhone.addEventListener('input', function() {
      const raw = newPhone.value.trim();
      if (/^n\/a$/i.test(raw)) {
        newPhone.value = 'N/A';
        return;
      }
      const digits = raw.replace(/\D/g, '');
      newPhone.value = digits.slice(0, 9);
    });
    newPhone.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/^n\/a$/i.test(String(text).trim())) {
        newPhone.value = 'N/A';
        return;
      }
      newPhone.value = String(text).replace(/\D/g, '').slice(0, 9);
    });
    // Auto-fill to 'N/A' when left blank on blur
    newPhone.addEventListener('blur', function() {
      if ((newPhone.value || '').trim() === '') {
        newPhone.value = 'N/A';
      }
    });
  }

  // SSS: 10 digits
  const sss = document.getElementById('employee-sss');
  if (sss) {
    const newSss = sss.cloneNode(true);
    sss.parentNode.replaceChild(newSss, sss);
    newSss.addEventListener('input', function() {
      const raw = newSss.value.trim();
      if (/^n\/a$/i.test(raw)) {
        newSss.value = 'N/A';
        return;
      }
      const digits = raw.replace(/\D/g, '');
      newSss.value = digits.slice(0, 10);
    });
    newSss.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/^n\/a$/i.test(String(text).trim())) {
        newSss.value = 'N/A';
        return;
      }
      newSss.value = String(text).replace(/\D/g, '').slice(0, 10);
    });
    // Auto-fill to 'N/A' when left blank on blur (SSS only)
    newSss.addEventListener('blur', function() {
      if ((newSss.value || '').trim() === '') {
        newSss.value = 'N/A';
      }
    });
  }

  const phil = document.getElementById('employee-philhealth');
  if (phil) {
    // Clone to remove any previous listeners
    const newPhil = phil.cloneNode(true);
    phil.parentNode.replaceChild(newPhil, phil);
    newPhil.addEventListener('input', function() {
      const raw = newPhil.value.trim();
      if (/^n\/a$/i.test(raw)) {
        newPhil.value = 'N/A';
        return;
      }
      const digits = raw.replace(/\D/g, '');
      newPhil.value = digits.slice(0, 12);
    });
    newPhil.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/^n\/a$/i.test(String(text).trim())) {
        newPhil.value = 'N/A';
        return;
      }
      newPhil.value = String(text).replace(/\D/g, '').slice(0, 12);
    });
    // Auto-fill to 'N/A' when left blank on blur
    newPhil.addEventListener('blur', function() {
      if ((newPhil.value || '').trim() === '') {
        newPhil.value = 'N/A';
      }
    });
  }

  // Emergency Contact Number: 9 digits
  const emergency = document.getElementById('employee-emergency-contact');
  if (emergency) {
    const newEmergency = emergency.cloneNode(true);
    emergency.parentNode.replaceChild(newEmergency, emergency);
    newEmergency.addEventListener('input', function() {
      const raw = newEmergency.value.trim();
      if (/^n\/a$/i.test(raw)) {
        newEmergency.value = 'N/A';
        return;
      }
      const digits = raw.replace(/\D/g, '');
      newEmergency.value = digits.slice(0, 9);
    });
    newEmergency.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/^n\/a$/i.test(String(text).trim())) {
        newEmergency.value = 'N/A';
        return;
      }
      newEmergency.value = String(text).replace(/\D/g, '').slice(0, 9);
    });
    // Auto-fill to 'N/A' when left blank on blur
    newEmergency.addEventListener('blur', function() {
      if ((newEmergency.value || '').trim() === '') {
        newEmergency.value = 'N/A';
      }
    });
  }

  // Email: auto N/A on blank
  const email = document.getElementById('employee-email');
  if (email) {
    const newEmail = email.cloneNode(true);
    email.parentNode.replaceChild(newEmail, email);
    newEmail.addEventListener('blur', function() {
      if ((newEmail.value || '').trim() === '') {
        newEmail.value = 'N/A';
      }
    });
  }
}

// Edit employee
function editEmployee(employeeId, employees) {
  // Find employee
  const employee = employees.find(emp => emp.id === employeeId);
  
  if (employee) {
    // Set form values
    document.getElementById('employee-id').value = employee.id;
    document.getElementById('employee-name').value = employee.name;
    document.getElementById('employee-email').value = employee.email;
    document.getElementById('employee-phone').value = employee.phone || '';
    document.getElementById('employee-department').value = employee.department;
    document.getElementById('employee-designation').value = employee.designation;
    document.getElementById('employee-join-date').value = formatDateForInput(employee.joinDate);
    document.getElementById('employee-basic-salary').value = employee.basicSalary;
    
    // Set new fields
    document.getElementById('employee-birthday').value = employee.birthday || '';
    document.getElementById('employee-address').value = employee.address || '';
    document.getElementById('employee-sss').value = employee.sssNumber || '';
    document.getElementById('employee-tin').value = employee.tin || '';
    document.getElementById('employee-philhealth').value = employee.philhealth || '';
    document.getElementById('employee-mother').value = employee.mothersName || '';
    document.getElementById('employee-father').value = employee.fathersName || '';

    // Ensure Position suggestions are initialized
    initPositionSuggestions();
    document.getElementById('employee-emergency-contact').value = employee.emergencyContact || '';
    
    // Set signature data if available
    if (employee.signature) {
      document.getElementById('employee-signature-data').value = employee.signature;
      
      // Show signature preview
      const signaturePreview = document.getElementById('signature-preview');
      if (signaturePreview) {
        signaturePreview.src = employee.signature;
        signaturePreview.classList.add('has-signature');
      }
    } else {
      document.getElementById('employee-signature-data').value = '';
      
      // Hide signature preview
      const signaturePreview = document.getElementById('signature-preview');
      if (signaturePreview) {
        signaturePreview.src = '';
        signaturePreview.classList.remove('has-signature');
      }
    }
    
    // Update modal title
    document.getElementById('employeeModalLabel').textContent = 'Edit Employee';
    
    // Apply optimization to form inputs to prevent lag when typing
    optimizeEmployeeFormInputs();
    // Attach numeric enforcement for TIN and PhilHealth in edit mode
    attachNumericIdListeners();

    // Populate department suggestions from existing employees (edit mode)
    try {
      if (window.api && window.api.getEmployees) {
        window.api.getEmployees().then(updateDepartmentDatalist).catch(() => updateDepartmentDatalist([]));
      } else {
        updateDepartmentDatalist([]);
      }
    } catch (_) { updateDepartmentDatalist([]); }
    
    // Remove any existing event handlers to prevent duplicates
    $('#employee-modal').off('shown.bs.modal');
    
    // Ensure save button always works
    const saveBtn = document.getElementById('save-employee-btn');
    if (saveBtn) {
      // Remove old event listeners by cloning (do not copy inline handlers)
      const newSaveBtn = saveBtn.cloneNode(false);
      // Preserve visible label
      newSaveBtn.textContent = saveBtn.textContent || 'Save';
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      // Ensure no inline onclick remains
      newSaveBtn.onclick = null;
      // Add event listener to the new button
      newSaveBtn.addEventListener('click', saveEmployee);
    }
    
    // Show modal
    $('#employee-modal').modal('show');
    
    // Initialize signature pad after modal is shown to ensure canvas is visible
    $('#employee-modal').on('shown.bs.modal', function() {
      currentSignaturePad = initSignaturePad();
      
      // Load existing signature if available
      if (employee.signature) {
        setSignatureData(currentSignaturePad, employee.signature);
      }
    });
  }
}

// Save employee
async function saveEmployee() {
  try {
    // Get form values
    const employeeId = document.getElementById('employee-id').value;
    const employee = {
      name: document.getElementById('employee-name').value,
      email: document.getElementById('employee-email').value,
      phone: document.getElementById('employee-phone').value,
      department: document.getElementById('employee-department').value,
      designation: document.getElementById('employee-designation').value,
      joinDate: document.getElementById('employee-join-date').value,
      basicSalary: parseFloat(document.getElementById('employee-basic-salary').value),
      // New fields
      birthday: document.getElementById('employee-birthday').value,
      address: document.getElementById('employee-address').value,
      sssNumber: document.getElementById('employee-sss').value,
      tin: document.getElementById('employee-tin').value,
      philhealth: document.getElementById('employee-philhealth').value,
      mothersName: document.getElementById('employee-mother').value,
      fathersName: document.getElementById('employee-father').value,
      emergencyContact: document.getElementById('employee-emergency-contact').value
    };
    
    // Get existing signature data
    let signatureData = document.getElementById('employee-signature-data').value;
    
    // If the global signature pad has data, use that instead
    if (currentSignaturePad && !currentSignaturePad.isEmpty()) {
      signatureData = getSignatureData(currentSignaturePad);
    }
    
    // Check if we need to add or remove the signature
    if (signatureData) {
      // Add signature to employee object if available
      employee.signature = signatureData;
    } else if (employeeId) {
      // If editing an existing employee and signature data is empty,
      // explicitly set signature to null to remove it from the database
      employee.signature = null;
    }
    
    // Validate form
    if (!employee.name || !employee.email || !employee.department || !employee.designation || !employee.joinDate || isNaN(employee.basicSalary)) {
      showNotification('Please fill all required fields', 'warning');
      return;
    }

    // SSS: allow 'N/A' or exactly 10 digits
    let sssRaw = (employee.sssNumber || '').trim();
    // If left blank, automatically set to N/A (SSS only)
    if (sssRaw === '') {
      employee.sssNumber = 'N/A';
    } else if (/^n\/a$/i.test(sssRaw)) {
      employee.sssNumber = 'N/A';
    } else {
      const sssDigits = sssRaw.replace(/\D/g, '');
      if (sssDigits.length !== 10) {
        showNotification('SSS Id Number must be exactly 10 digits or N/A', 'warning');
        return;
      }
      employee.sssNumber = sssDigits;
    }

    // TIN: allow 'N/A' or exactly 12 digits
    const tinRaw = (employee.tin || '').trim();
    if (tinRaw === '') {
      employee.tin = 'N/A';
    } else if (/^n\/a$/i.test(tinRaw)) {
      employee.tin = 'N/A';
    } else {
      const tinDigits = tinRaw.replace(/\D/g, '');
      if (tinDigits.length !== 12) {
        showNotification('Tin Id Number must be exactly 12 digits or N/A', 'warning');
        return;
      }
      employee.tin = tinDigits;
    }

    // PhilHealth: allow 'N/A' or exactly 12 digits
    const philRaw = (employee.philhealth || '').trim();
    if (philRaw === '') {
      employee.philhealth = 'N/A';
    } else if (/^n\/a$/i.test(philRaw)) {
      employee.philhealth = 'N/A';
    } else {
      const philDigits = philRaw.replace(/\D/g, '');
      if (philDigits.length !== 12) {
        showNotification('PhilHealth ID must be exactly 12 digits or N/A', 'warning');
        return;
      }
      employee.philhealth = philDigits;
    }

    // Telephone: allow 'N/A' or exactly 9 digits
    const phoneRaw = (employee.phone || '').trim();
    if (phoneRaw === '') {
      employee.phone = 'N/A';
    } else if (/^n\/a$/i.test(phoneRaw)) {
      employee.phone = 'N/A';
    } else {
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      if (phoneDigits.length !== 9) {
        showNotification('Telephone Number must be exactly 9 digits or N/A', 'warning');
        return;
      }
      employee.phone = phoneDigits;
    }

    // Email: auto N/A when blank
    if ((employee.email || '').trim() === '') {
      employee.email = 'N/A';
    }

    // Emergency Contact: allow 'N/A' or exactly 9 digits
    const emergencyRaw = (employee.emergencyContact || '').trim();
    if (/^n\/a$/i.test(emergencyRaw)) {
      employee.emergencyContact = 'N/A';
    } else {
      const emergencyDigits = emergencyRaw.replace(/\D/g, '');
      if (emergencyDigits.length !== 9) {
        showNotification('Emergency Contact Number must be exactly 9 digits or N/A', 'warning');
        return;
      }
      employee.emergencyContact = emergencyDigits;
    }
    
    // Add or update employee
    if (employeeId) {
      // Update existing employee locally
      employee.id = employeeId;
      const updated = await window.api.updateEmployee(employee);
      
      // Sync update to Supabase if online; otherwise queue for later
      if (updated && window.supabase && navigator.onLine) {
        try {
          // Prepare payload for Supabase (exclude local-only fields)
          const supPayload = sanitizeEmployeeForSupabase(updated);
          
          let syncOk = false;
          let syncErr = null;
          
          if (updated.supabaseId) {
            const { data, error } = await window.supabase
              .from('employees')
              .update(supPayload)
              .eq('id', updated.supabaseId)
              .select();
            syncOk = !!(data && data.length > 0);
            syncErr = error || null;
          } else {
            // Try update by unique email
            const { data, error } = await window.supabase
              .from('employees')
              .update(supPayload)
              .eq('email', updated.email)
              .select();
            syncOk = !!(data && data.length > 0);
            syncErr = error || null;
            
            // If no row was matched, upsert (create or replace by email)
            if (!syncOk && !syncErr) {
              const { data: upsertData, error: upsertError } = await window.supabase
                .from('employees')
                .upsert(supPayload, { onConflict: 'email' })
                .select();
              syncOk = !!(upsertData && upsertData.length > 0);
              syncErr = upsertError || null;
              // Persist Supabase id if we just created/updated
              if (syncOk && upsertData && upsertData.length > 0) {
                await window.api.updateEmployee({ id: updated.id, supabaseId: upsertData[0].id });
              }
            }
          }
          
          if (syncErr) {
            console.error('Supabase update error:', syncErr);
            showNotification('Employee updated locally, but Supabase sync failed: ' + (syncErr.message || 'unknown error'), 'warning');
          }
        } catch (supErr) {
          console.error('Supabase update exception:', supErr);
          showNotification('Employee updated locally, but Supabase sync failed: ' + supErr.message, 'warning');
        }
      } else if (updated) {
        // Queue sync operation for later when back online
        await window.api.enqueueSync({ type: 'employee', action: 'update', payload: updated });
        showNotification('Employee updated locally. Will sync when online.', 'info');
      }
      
      showNotification('Employee updated successfully', 'success');
    } else {
      // Add new employee
      employee.email = employee.email.trim().toLowerCase();
      
      // Add employee locally first
      const result = await window.api.addEmployee(employee);
      
      // Check if there was an error (duplicate employee locally)
      if (result && result.success === false) {
        showNotification(result.error || 'Employee already exists', 'warning');
        return;
      }
      
      // If local add succeeded, sync to Supabase if online; otherwise queue for later
      if (result && result.id && navigator.onLine && window.supabase) {
        try {
          // Insert into Supabase
          const { data, error } = await supabase
            .from('employees')
            .insert([sanitizeEmployeeForSupabase(employee)])
            .select();
          
          if (error) {
            console.error('Supabase insert error:', error);
            showNotification('Employee added locally, but Supabase sync failed: ' + error.message, 'warning');
          } else {
            console.log('Inserted employee to Supabase:', data);
            // Persist Supabase row id in local store for reliable deletes
            if (data && data.length > 0) {
              await window.api.updateEmployee({ id: result.id, supabaseId: data[0].id });
            }
          }
        } catch (supabaseError) {
          console.error('Supabase insert exception:', supabaseError);
          showNotification('Employee added locally, but Supabase sync failed: ' + supabaseError.message, 'warning');
        }
      } else if (result && result.id) {
        await window.api.enqueueSync({ type: 'employee', action: 'create', payload: { ...employee, id: result.id } });
        showNotification('Employee added locally. Will sync when online.', 'info');
      }
      
      showNotification('Employee added successfully', 'success');
    }
    
    // Close modal
    $('#employee-modal').modal('hide');
    
    // Reload employees - this will also update the department dropdown
    loadEmployees();
    
    // Update employee status counts immediately
    searchEmployees();
    
    // Reload dashboard data
    loadDashboardData();
  } catch (error) {
    showNotification('Error saving employee', 'danger');
    console.error('Save employee error:', error);
  }
}

// Delete employee
async function deleteEmployee(employeeId) {
  const employee = await window.api.getEmployee(employeeId);
  const employeeName = employee ? employee.name : 'this employee';

  showCustomDialog({
    title: 'Delete Employee',
    message: `Are you sure you want to delete ${employeeName}?`,
    onConfirm: async () => {
      try {
        // Delete locally via Electron store
        await window.api.deleteEmployee(employeeId);

        // Also delete from Supabase
        if (window.supabase && employee) {
          let supabaseDeleteError = null;

          // Prefer deleting by stored Supabase id when available
          if (employee.supabaseId) {
            const { error } = await window.supabase
              .from('employees')
              .delete()
              .eq('id', employee.supabaseId);
            supabaseDeleteError = error || null;

            // If id type mismatch (e.g., 22P02), fall back to email
            if (supabaseDeleteError && (supabaseDeleteError.code === '22P02' || (supabaseDeleteError.message || '').toLowerCase().includes('invalid input syntax'))) {
              const { error: fallbackError } = await window.supabase
                .from('employees')
                .delete()
                .eq('email', employee.email || '');
              supabaseDeleteError = fallbackError || null;
            }
          } else if (employee.email) {
            // No Supabase id stored; delete by unique email
            const { error } = await window.supabase
              .from('employees')
              .delete()
              .eq('email', employee.email);
            supabaseDeleteError = error || null;
          }

          if (supabaseDeleteError) {
            console.error('Supabase delete error:', supabaseDeleteError);
            showNotification('Employee deleted locally, but Supabase delete failed: ' + supabaseDeleteError.message, 'warning');
          }
        }

        showNotification('Employee deleted successfully', 'success');
        // No need to manually reload - the employee-deleted event will trigger the refresh
      } catch (error) {
        showNotification('Error deleting employee', 'danger');
        console.error('Delete employee error:', error);
      }
    }
  });
}

// Set employee on leave
async function setEmployeeOnLeave(employeeId, employeeName) {
  showCustomDialog({
    title: 'Set on Leave',
    message: `Are you sure you want to set ${employeeName} on leave?`,
    onConfirm: async () => {
      try {
        const result = await window.api.setEmployeeOnLeave(employeeId);
        
        if (result.success) {
          showNotification(result.message, 'success');
          // Reload employee table to reflect status change
          if (window.loadEmployees) {
            await window.loadEmployees();
          }
        } else {
          showNotification(result.message, 'error');
        }
      } catch (error) {
        showNotification('Error setting employee on leave', 'danger');
        console.error('Set employee on leave error:', error);
      }
    }
  });
}

// Remove employee from leave
async function removeEmployeeFromLeave(employeeId, employeeName) {
  showCustomDialog({
    title: 'Remove from Leave',
    message: `Are you sure you want to remove ${employeeName} from leave status?`,
    onConfirm: async () => {
      try {
        const result = await window.api.removeEmployeeFromLeave(employeeId);
        
        if (result.success) {
          showNotification(result.message, 'success');
          // Reload employee table to reflect status change
          if (window.loadEmployees) {
            await window.loadEmployees();
          }
        } else {
          showNotification(result.message, 'error');
        }
      } catch (error) {
        showNotification('Error removing employee from leave', 'danger');
        console.error('Remove employee from leave error:', error);
      }
    }
  });
}

let payheads = [];

// Load payheads data
async function loadPayheads() {
  try {
    payheads = await window.api.getPayheads();
    const earningsBody = document.getElementById('earnings-list');
    const deductionsBody = document.getElementById('deductions-list');
    
    // Clear existing rows
    earningsBody.innerHTML = '';
    deductionsBody.innerHTML = '';
    
    // Add payhead rows
    payheads.forEach(payhead => {
      const row = document.createElement('tr');
      const hasAmount = (payhead.amount != null && payhead.amount !== '' && !isNaN(parseFloat(payhead.amount)));
      const amountVal = hasAmount ? parseFloat(payhead.amount) : null;
      const hasPct = (payhead.percentage != null && payhead.percentage !== '' && !isNaN(parseFloat(payhead.percentage)));
      const pctVal = hasPct ? parseFloat(payhead.percentage) : null;
      const valueDisplay = hasAmount ? formatCurrency(amountVal) : (pctVal != null ? `${pctVal}%` : '-');
      row.innerHTML = `
        <td>${payhead.name}</td>
        <td>${valueDisplay}</td>
        <td>
          <button class="action-btn edit-btn edit-payhead" data-id="${payhead.id}"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete-btn delete-payhead" data-id="${payhead.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      
      // Add to appropriate table
      if (payhead.type === 'earning') {
        earningsBody.appendChild(row);
      } else if (payhead.type === 'deduction') {
        deductionsBody.appendChild(row);
      }
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-payhead').forEach(button => {
      button.addEventListener('click', function() {
        const payheadId = this.getAttribute('data-id');
        editPayhead(payheadId, payheads);
      });
    });
    
    document.querySelectorAll('.delete-payhead').forEach(button => {
      button.addEventListener('click', function() {
        const payheadId = this.getAttribute('data-id');
        deletePayhead(payheadId);
      });
    });
  } catch (error) {
    showNotification('Error loading payheads', 'danger');
    console.error('Payheads error:', error);
  }
}

// Show add payhead modal
function showAddPayheadModal() {
  // Reset form
  document.getElementById('payhead-form').reset();
  document.getElementById('payhead-id').value = '';
  document.getElementById('payheadModalLabel').textContent = 'Add Payhead';
  const pctInput = document.getElementById('payhead-percentage');
  if (pctInput) pctInput.value = '';
  const amtInput = document.getElementById('payhead-amount');
  if (amtInput) amtInput.value = '';
  const valueTypeSelect = document.getElementById('payhead-value-type');
  if (valueTypeSelect) valueTypeSelect.value = 'percentage';
  updatePayheadValueTypeUI();
  
  // Show modal
  $('#payhead-modal').modal('show');
}

// Edit payhead
function editPayhead(payheadId, payheads) {
  // Find payhead
  const payhead = payheads.find(ph => ph.id === payheadId);
  
  if (payhead) {
    // Set form values
    document.getElementById('payhead-id').value = payhead.id;
    document.getElementById('payhead-name').value = payhead.name;
    document.getElementById('payhead-description').value = payhead.description || '';
    document.getElementById('payhead-type').value = payhead.type;
    const pctInput = document.getElementById('payhead-percentage');
    const amtInput = document.getElementById('payhead-amount');
    const valueTypeSelect = document.getElementById('payhead-value-type');
    const valueType = payhead.valueType || ((payhead.amount != null && payhead.amount !== '') ? 'amount' : 'percentage');
    if (valueTypeSelect) valueTypeSelect.value = valueType;
    if (valueType === 'amount') {
      if (amtInput) amtInput.value = (payhead.amount != null && payhead.amount !== '') ? Number(payhead.amount) : '';
      if (pctInput) pctInput.value = '';
    } else {
      if (pctInput) pctInput.value = (payhead.percentage != null && payhead.percentage !== '') ? Number(payhead.percentage) : '';
      if (amtInput) amtInput.value = '';
    }
    updatePayheadValueTypeUI();
    
    // Update modal title
    document.getElementById('payheadModalLabel').textContent = 'Edit Payhead';
    
    // Show modal
    $('#payhead-modal').modal('show');
  }
}

// Save payhead
async function savePayhead() {
  try {
    // Get form values
    const payheadId = document.getElementById('payhead-id').value;
    const payhead = {
      name: document.getElementById('payhead-name').value,
      description: document.getElementById('payhead-description').value,
      type: document.getElementById('payhead-type').value
    };
    // Value type and value
    const valueType = (document.getElementById('payhead-value-type')?.value || 'percentage').trim();
    payhead.valueType = valueType;
    if (valueType === 'amount') {
      const amtStr = (document.getElementById('payhead-amount')?.value || '').trim();
      if (amtStr !== '') {
        const parsedAmt = parseFloat(amtStr);
        if (!isNaN(parsedAmt)) {
          payhead.amount = parsedAmt < 0 ? 0 : parsedAmt;
        }
      }
      // Ensure percentage is cleared when amount type
      if ('percentage' in payhead) delete payhead.percentage;
    } else {
      // Percentage (optional)
      const pctStr = (document.getElementById('payhead-percentage')?.value || '').trim();
      if (pctStr !== '') {
        const parsed = parseFloat(pctStr);
        if (!isNaN(parsed)) {
          payhead.percentage = parsed < 0 ? 0 : parsed;
        }
      }
      // Ensure amount is cleared when percentage type
      if ('amount' in payhead) delete payhead.amount;
    }
    
    // Validate form
    if (!payhead.name || !payhead.type) {
      showNotification('Please fill all required fields', 'warning');
      return;
    }
    
    // Add or update payhead
    if (payheadId) {
      // Update existing payhead
      payhead.id = payheadId;
      await window.api.updatePayhead(payhead);
      showNotification('Payhead updated successfully', 'success');
    } else {
      // Add new payhead
      await window.api.addPayhead(payhead);
      showNotification('Payhead added successfully', 'success');
    }
    
    // Close modal
    $('#payhead-modal').modal('hide');
    
    // Reload payheads
    loadPayheads();
    
    // Reload dashboard data
    loadDashboardData();
  } catch (error) {
    showNotification('Error saving payhead', 'danger');
    console.error('Save payhead error:', error);
  }
}

// Delete payhead
async function deletePayhead(payheadId) {
  const payhead = payheads.find(p => p.id === payheadId);
  const payheadName = payhead ? payhead.name : 'this payhead';

  showCustomDialog({
    title: 'Delete Payhead',
    message: `Are you sure you want to delete ${payheadName}?`,
    onConfirm: async () => {
      try {
        // Call the API to delete the payhead
        await window.api.deletePayhead(payheadId);
        showNotification('Payhead deleted successfully', 'success');
        
        // Reload payheads
        loadPayheads();
        
        // Reload dashboard data
        loadDashboardData();
      } catch (error) {
        showNotification('Error deleting payhead', 'danger');
        console.error('Delete payhead error:', error);
      }
    }
  });
}

// Show employee report modal
function showEmployeeReportModal() {
  try {
    // Reset the employee select dropdown
    const employeeSelect = document.getElementById('report-employee-select');
    
    // Clear existing options except the 'All Employees' option
    while (employeeSelect.options.length > 1) {
      employeeSelect.remove(1);
    }
    
    // Load employees and populate the dropdown
    window.api.getEmployees().then(employees => {
      employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = employee.name;
        employeeSelect.appendChild(option);
      });
      
      // Show the modal
      $('#employee-report-select-modal').modal('show');
    }).catch(error => {
      console.error('Error loading employees for report:', error);
      showNotification('Error loading employees', 'danger');
    });
  } catch (error) {
    console.error('Error showing employee report modal:', error);
    showNotification('Error showing report modal', 'danger');
  }
}

// Show salary report modal
function showSalaryReportModal() {
  try {
    // Populate year dropdown
    const yearSelect = document.getElementById('report-year-select');
    yearSelect.innerHTML = '';
    
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 5; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }
    
    // Set current month
    const currentMonth = new Date().getMonth() + 1; // JavaScript months are 0-indexed
    document.getElementById('report-month-select').value = currentMonth;
    
    // Show modal
    $('#salary-report-modal').modal('show');
  } catch (error) {
    console.error('Error showing salary report modal:', error);
    showNotification('Error showing report modal', 'danger');
  }
}

// Generate department report
function generateDepartmentReport() {
  try {
    // Get all employees
    window.api.getEmployees().then(employees => {
      if (!employees || employees.length === 0) {
        showNotification('No employees found', 'warning');
        return;
      }
      
      // Group employees by department
      const departmentMap = {};
      employees.forEach(employee => {
        const department = employee.department || 'Unassigned';
        if (!departmentMap[department]) {
          departmentMap[department] = [];
        }
        departmentMap[department].push(employee);
      });
      
      // Generate report HTML
      let reportHTML = `
        <div class="report-container">
          <div class="report-header">
            <h3>Department Report</h3>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="report-content">
      `;
      
      // Add department sections
      Object.keys(departmentMap).sort().forEach(department => {
        const departmentEmployees = departmentMap[department];
        reportHTML += `
          <div class="department-section">
            <h4>${department} (${departmentEmployees.length} employees)</h4>
            <table class="table table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Basic Salary</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add employee rows
        departmentEmployees.forEach(employee => {
          reportHTML += `
            <tr>
              <td>${employee.id}</td>
              <td>${employee.name}</td>
              <td>${employee.designation || employee.position || '-'}</td>
              <td>${employee.status || 'Active'}</td>
              <td>${formatCurrency(employee.basicSalary || 0)}</td>
            </tr>
          `;
        });
        
        reportHTML += `
              </tbody>
            </table>
          </div>
        `;
      });
      
      reportHTML += `
          </div>
        </div>
      `;
      
      // Display report in modal
      document.getElementById('department-report-content').innerHTML = reportHTML;
      $('#department-report-modal').modal('show');
    }).catch(error => {
      console.error('Error generating department report:', error);
      showNotification('Error generating department report', 'danger');
    });
  } catch (error) {
    console.error('Error generating department report:', error);
    showNotification('Error generating department report', 'danger');
  }
}

// Generate employee report
async function generateEmployeeReport(employeeId) {
  try {
    // Close the select modal
    $('#employee-report-select-modal').modal('hide');

    // Get employee data
    const employees = employeeId === 'all'
      ? await window.api.getEmployees()
      : [await window.api.getEmployee(employeeId)];

    if (!employees || employees.length === 0) {
      showNotification('No employee data found', 'warning');
      return;
    }

    // Fetch attendance data once
    let attendanceData = [];
    if (window.fetchAttendanceData) {
      attendanceData = await window.fetchAttendanceData();
    }

    // Generate report HTML
    let reportHTML = `
      <div class="report-container">
        <div class="report-header">
          <h3>Employee Report</h3>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="report-content">
    `;

    // Add employee details
    employees.forEach(employee => {
      // Use latest attendance for status
      let status = employee.status || 'Active';
      if (attendanceData) {
        const records = attendanceData.filter(record => record.user_name === employee.name);
        if (records.length > 0) {
          records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const latest = records[0];
          const today = new Date().toISOString().slice(0, 10);
          const attendanceDate = new Date(latest.timestamp).toISOString().slice(0, 10);
          if (attendanceDate === today && latest.type === 'clock-in') {
            status = 'time in';
          } else if (attendanceDate === today && latest.type === 'clock-out') {
            status = 'inactive';
          }
        }
      }
      reportHTML += `
        <div class="employee-section">
          <h4>${employee.name}</h4>
          <div class="employee-details">
            <div><span>ID:</span> ${employee.id}</div>
            <div><span>Department:</span> ${employee.department || 'Unassigned'}</div>
            <div><span>Position:</span> ${employee.designation || '-'}</div>
            <div><span>Status:</span> ${status}</div>
            <div><span>Basic Salary:</span> ${formatCurrency(employee.basicSalary || 0)}</div>
            <div><span>Email:</span> ${employee.email || '-'}</div>
            <div><span>Phone:</span> ${employee.phone || '-'}</div>
            <div><span>Birthday:</span> ${employee.birthday || '-'}</div>
            <div><span>Address:</span> ${employee.address || '-'}</div>
            <div><span>SSS Number:</span> ${employee.sssNumber || '-'}</div>
            <div><span>TIN:</span> ${employee.tin || '-'}</div>
            <div><span>PhilHealth:</span> ${employee.philhealth || '-'}</div>
            <div><span>Mother's Name:</span> ${employee.mothersName || '-'}</div>
            <div><span>Father's Name:</span> ${employee.fathersName || '-'}</div>
            <div><span>Emergency Contact:</span> ${employee.emergencyContact || '-'}</div>
          </div>
        </div>
      `;
    });

    reportHTML += `
        </div>
      </div>
    `;

    // Display report in modal
    document.getElementById('employee-report-content').innerHTML = reportHTML;
    $('#employee-report-modal').modal('show');
  } catch (error) {
    console.error('Error generating employee report:', error);
    showNotification('Error generating employee report', 'danger');
  }
}

// Generate salary report
function generateSalaryReport() {
  try {
    // Get form values
    const month = parseInt(document.getElementById('report-month-select').value);
    const year = parseInt(document.getElementById('report-year-select').value);
    
    console.log('Generating salary report for:', { month, year });
    
    // Close the select modal
    $('#salary-report-modal').modal('hide');
    
    // Get salaries for the selected period
    window.api.getSalaries({ month, year })
    .then(salaries => {
      console.log('Received salaries data:', salaries);
      if (!salaries || salaries.length === 0) {
        showNotification('No salary data found for the selected period', 'warning');
        return;
      }
      
      // Get employee data for the salaries
      const employeeIds = [...new Set(salaries.map(salary => salary.employeeId))];
      const employeePromises = employeeIds.map(id => window.api.getEmployee(id));
      
      Promise.all(employeePromises).then(employees => {
        // Create employee map for quick lookup
        const employeeMap = {};
        employees.forEach(employee => {
          if (employee) {
            employeeMap[employee.id] = employee;
          }
        });
        
        // Group salaries by department
        const departmentGroups = {};
        salaries.forEach(salary => {
          const employee = employeeMap[salary.employeeId] || {};
          const deptName = employee.department || 'Unassigned';
          if (!departmentGroups[deptName]) departmentGroups[deptName] = [];
          departmentGroups[deptName].push({ salary, employee });
        });

        // Generate report HTML with sections per department
        let reportHTML = `
          <div class="report-container">
            <div class="report-header">
              <h3>Salary Report - ${getMonthName(month)} ${year}</h3>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="report-content">
        `;

        const sortedDepartments = Object.keys(departmentGroups).sort();
        sortedDepartments.forEach((deptName, index) => {
          const records = departmentGroups[deptName];
          let deptTotalEarnings = 0;

          reportHTML += `
            <div class="department-section${index > 0 ? ' page-break' : ''}">
              <h4>${deptName}</h4>
              <table class="table table-bordered">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Days Worked</th>
                    <th>Rate</th>
                    <th>Basic Salary</th>
                    <th>Earnings</th>
                    <th>Deductions</th>
                    <th>Total Earnings</th>
                    <th>Net Salary</th>
                    <th>Signature</th>
                  </tr>
                </thead>
                <tbody>
          `;

          records.forEach(({ salary, employee }) => {
            const totalEarnings = parseFloat(salary.totalEarnings) || 0;
            deptTotalEarnings += totalEarnings;

            reportHTML += `
              <tr>
                <td>${employee.name || 'Unknown'}</td>
                <td>${employee.department || 'Unassigned'}</td>
                <td>${(salary.daysWorked != null && salary.daysWorked !== '') ? Number(salary.daysWorked) : '-'}</td>
                <td>${(salary.dailyRate != null && salary.dailyRate !== '') ? formatCurrency(Number(salary.dailyRate)) : '-'}</td>
                <td>${formatCurrency(employee.basicSalary || 0)}</td>
                <td>${formatCurrency(salary.totalEarnings || 0)}</td>
                <td>${formatCurrency(salary.totalDeductions || 0)}</td>
                <td>${formatCurrency(totalEarnings)}</td>
                <td>${formatCurrency(salary.netSalary || 0)}</td>
                <td>${salary.signature ? `<img src=\"${salary.signature}\" alt=\"Signature\" style=\"max-height:32px;\">` : '-'}</td>
              </tr>
            `;
          });

          reportHTML += `
                  <tr class="total-row">
                    <td colspan="7"><strong>Total</strong></td>
                    <td><strong>${formatCurrency(deptTotalEarnings)}</strong></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        });

        reportHTML += `
            </div>
          </div>
        `;
        
        // Display report in modal
        document.getElementById('salary-report-content').innerHTML = reportHTML;
        $('#salary-report-view-modal').modal('show');
      }).catch(error => {
        console.error('Error fetching employee data for salary report:', error);
        showNotification('Error generating salary report', 'danger');
      });
    }).catch(error => {
      console.error('Error generating salary report:', error);
      showNotification('Error generating salary report', 'danger');
    });
  } catch (error) {
    console.error('Error generating salary report:', error);
    showNotification('Error generating salary report', 'danger');
  }
}

// Helper function to get month name
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

// Print Preview Variables
let currentZoom = 100;
let printContent = '';

// Direct printing without preview
function showPrintPreview() {
    const modal = document.querySelector('.modal.show');
    if (modal) {
        // Get the content from the currently open modal
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            printContent = modalBody.innerHTML;
            printReport(); // Use direct printing instead of preview
        }
    }
}

// Open print preview modal
// All print preview functionality has been removed
// Direct printing is now handled in the printReport function

// Print report (direct printing without preview)
function printReport() {
    try {
        // Capture content from the currently open modal, falling back to printContent
        const modal = document.querySelector('.modal.show');
        const modalBody = modal ? modal.querySelector('.modal-body') : null;
        const contentHTML = modalBody ? modalBody.innerHTML : (printContent || '');

        if (!contentHTML || contentHTML.trim() === '') {
            showNotification('Nothing to print', 'warning');
            return;
        }

        // Decide which styles to include based on the content/modal
        const cssFiles = ['css/style.css'];
        let usePayslip = false;
        let useReports = false;

        if (modal && modal.id) {
            // Salary slip modal or view
            if (modal.id.includes('salary-slip') || modal.id.includes('view-salary')) {
                usePayslip = true;
            }
            // Any report-related modal
            if (modal.id.includes('report')) {
                useReports = true;
            }
        }
        // Fallback sniffing based on content markers
        if (!usePayslip && !useReports) {
            if (contentHTML.includes('payslip-container')) {
                usePayslip = true;
            } else if (contentHTML.includes('report-container')) {
                useReports = true;
            }
        }

        if (usePayslip) cssFiles.push('css/payslip.css');
        if (useReports) cssFiles.push('css/reports.css');

        const baseHref = document.baseURI || '';
        const linksMarkup = cssFiles.map(href => `<link rel="stylesheet" href="${href}">`).join('\n');

        const iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <base href="${baseHref}">
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                ${linksMarkup}
                <style>
                  @page { size: A4; margin: 10mm; }
                  html, body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    background: white;
                  }
                  .print-content { width: 100%; }
                  /* Override any global print rules that hide content (e.g., reports.css) */
                  @media print { body * { visibility: visible !important; } }
                </style>
              </head>
              <body>
                <div class="print-content">${contentHTML}</div>
              </body>
            </html>
        `);
        doc.close();

        // Give the iframe a moment to layout styles/images before printing
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Clean up after printing
            setTimeout(() => {
                iframe.remove();
            }, 1000);
        }, 200);
    } catch (err) {
        console.error('Print error:', err);
        showNotification('Error while printing', 'danger');
    }
}
// Global variable to store the salary signature pad instance
let salarySigPad = null;

// Show generate salary modal
async function showGenerateSalaryModal() {
  try {
    // Reset form
    document.getElementById('generate-salary-form').reset();
    const salarySigInput = document.getElementById('salary-signature-data');
    if (salarySigInput) {
      salarySigInput.value = '';
    }
    
    // Load employees
    const employees = await window.api.getEmployees();
    const employeeSelect = document.getElementById('salary-employee');
    const monthSelect = document.getElementById('salary-gen-month');
    const yearSelect = document.getElementById('salary-gen-year');

    function triggerAutofillDaysWorked() {
      const selectedOption = employeeSelect.options[employeeSelect.selectedIndex];
      const employeeName = selectedOption ? selectedOption.textContent : '';
      const month = parseInt(monthSelect.value);
      const year = parseInt(yearSelect.value);
      const paymentCycleEl = document.getElementById('payment-cycle');
      const paymentCycle = paymentCycleEl ? paymentCycleEl.value : '';
      const weekEl = document.getElementById('salary-week');
      const week = weekEl ? parseInt(weekEl.value) : null;
      const halfEl = document.getElementById('salary-half');
      const half = halfEl ? parseInt(halfEl.value) : null;
      if (employeeName && paymentCycle && month && year) {
        // Calculate only when all required fields are set
        autofillDaysWorked(employeeName, month, year, paymentCycle, week, half);
      } else {
        // Clear until all required fields are selected
        const dw = document.getElementById('days-worked');
        if (dw) {
          dw.value = '';
          dw.dispatchEvent(new Event('input', { bubbles: true }));
          dw.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

// Paste the code block here!
    // Clear existing options
    employeeSelect.innerHTML = '<option value="">Select Employee</option>';
    
    // Create a Set to track added employee IDs to prevent duplicates
    const addedEmployeeIds = new Set();
    
    // Add employee options
    employees.forEach(employee => {
      // Skip if this employee ID has already been added
      if (addedEmployeeIds.has(employee.id)) {
        return;
      }
      
      // Add the employee ID to the set
      addedEmployeeIds.add(employee.id);
      
      const option = document.createElement('option');
      option.value = employee.id;
      option.textContent = employee.name;
      option.setAttribute('data-basic-salary', employee.basicSalary || 0);
      employeeSelect.appendChild(option);
    });

    // Calculate only when month/year/payment cycle change (not on employee select)
    monthSelect.addEventListener('change', triggerAutofillDaysWorked);
    yearSelect.addEventListener('change', triggerAutofillDaysWorked);
    const paymentCycleEl = document.getElementById('payment-cycle');
    if (paymentCycleEl) paymentCycleEl.addEventListener('change', triggerAutofillDaysWorked);
    const weekEl = document.getElementById('salary-week');
    if (weekEl) weekEl.addEventListener('change', triggerAutofillDaysWorked);
    const halfEl = document.getElementById('salary-half');
    if (halfEl) halfEl.addEventListener('change', triggerAutofillDaysWorked);
    
    // Load payheads
    const payheads = await window.api.getPayheads();
    console.log('Loaded payheads:', payheads); // Debug log to check payheads
    const earningsContainer = document.getElementById('earnings-container');
    const deductionsContainer = document.getElementById('deductions-container');
    
    // Clear existing payheads
    earningsContainer.innerHTML = '';
    deductionsContainer.innerHTML = '';
    
    // Add basic salary field at the top of earnings
    const basicSalaryDiv = document.createElement('div');
    basicSalaryDiv.className = 'form-group';
    basicSalaryDiv.innerHTML = `
      <label for="basic-salary">Basic Salary</label>
      <input type="number" class="form-control earning-amount" id="basic-salary" data-id="basic-salary" data-name="Basic Salary" placeholder="Amount" readonly>
    `;
    earningsContainer.appendChild(basicSalaryDiv);
    
    // Add earnings
    const earnings = payheads.filter(payhead => payhead.type === 'earning');
    earnings.forEach(earning => {
      const div = document.createElement('div');
      div.className = 'form-group';
      const valueType = earning.valueType || ((earning.amount != null && earning.amount !== '') ? 'amount' : 'percentage');
      const pctValue = earning.percentage != null ? earning.percentage : '';
      const amtValue = earning.amount != null ? earning.amount : '';
      div.innerHTML = `
        <label for="earning-${earning.id}">${earning.name}</label>
        <input type="number" class="form-control earning-amount" id="earning-${earning.id}" data-id="${earning.id}" data-name="${earning.name}" data-value-type="${valueType}" data-percentage="${pctValue}" data-amount="${amtValue}" data-manual="false" placeholder="Amount">
      `;
      earningsContainer.appendChild(div);
    });
    
    // Add deductions
    const deductions = payheads.filter(payhead => payhead.type === 'deduction');
    deductions.forEach(deduction => {
      const div = document.createElement('div');
      div.className = 'form-group';
      const valueType = deduction.valueType || ((deduction.amount != null && deduction.amount !== '') ? 'amount' : 'percentage');
      const pctValue = deduction.percentage != null ? deduction.percentage : '';
      const amtValue = deduction.amount != null ? deduction.amount : '';
      div.innerHTML = `
        <label for="deduction-${deduction.id}">${deduction.name}</label>
        <input type="number" class="form-control deduction-amount" id="deduction-${deduction.id}" data-id="${deduction.id}" data-name="${deduction.name}" data-value-type="${valueType}" data-percentage="${pctValue}" data-amount="${amtValue}" data-manual="false" placeholder="Amount">
      `;
      deductionsContainer.appendChild(div);
    });

    // Perform initial autofill for fixed amount payheads and percentage-based using current base
    applyPercentageAutofill();
    
    // Add event listener to employee select to update basic salary
    // Autofill Days Worked function
    // Autofill Days Worked function
async function autofillDaysWorked(employeeName, month, year, paymentCycle = 'monthly', week = null, half = null) {
  console.log(`Autofilling days worked for ${employeeName} in month ${month}, year ${year}, cycle ${paymentCycle}${paymentCycle === 'weekly' ? `, week ${week}` : ''}${paymentCycle === '15days' ? `, half ${half}` : ''}`);
  
  // Get attendance data
  let attendanceData = [];
  try {
    if (window.fetchAttendanceData) {
      attendanceData = await window.fetchAttendanceData();
      console.log('Fetched attendance data:', attendanceData);
    }
    
    // Default to 0 days - we'll only count actual attendance
    let totalDaysWorked = 0;
    
    if (attendanceData && attendanceData.length > 0) {
      // Ensure month is a number
      month = Number(month);
      
      // Track attendance by day with hours worked
      const daysWithHours = {};
      
      // Process all attendance records for this employee in the specified month/year
      attendanceData.forEach(record => {
        // Skip records without necessary data
        if (!record.timestamp) return;
        
        // Check if this record belongs to the selected employee
        const recordEmployeeName = record.user_name || record.employee_name || record.employeeName || '';
        if (!recordEmployeeName.includes(employeeName) && !employeeName.includes(recordEmployeeName)) return;
        
        // Parse the date from the timestamp
        const dateObj = new Date(record.timestamp);
        const recordMonth = dateObj.getMonth() + 1;
        const recordYear = dateObj.getFullYear();
        
        // Check if this record is for the selected month and year
        if (recordMonth !== month || recordYear !== year) return;
        
        // Get the date string (YYYY-MM-DD)
        const dateStr = dateObj.toISOString().split('T')[0];
        
        // Initialize this day's hours if not already tracked
        if (!daysWithHours[dateStr]) {
          daysWithHours[dateStr] = {
            timeIn: null,
            timeOut: null,
            hoursWorked: 0
          };
        }
        
        // Check if this is a time in or time out record
        const recordType = record.type || '';
        const timeValue = dateObj;
        
        if (recordType.toLowerCase().includes('in')) {
          // This is a time in record
          daysWithHours[dateStr].timeIn = timeValue;
        } else if (recordType.toLowerCase().includes('out')) {
          // This is a time out record
          daysWithHours[dateStr].timeOut = timeValue;
        }
        
        // Calculate hours worked if we have both time in and time out
        if (daysWithHours[dateStr].timeIn && daysWithHours[dateStr].timeOut) {
          const timeIn = daysWithHours[dateStr].timeIn;
          const timeOut = daysWithHours[dateStr].timeOut;
          
          // Calculate hours worked (in milliseconds, then convert to hours)
          const hoursWorked = (timeOut - timeIn) / (1000 * 60 * 60);
          daysWithHours[dateStr].hoursWorked = hoursWorked;
          
          console.log(`${dateStr}: Hours worked = ${hoursWorked.toFixed(2)}`);
        }
      });
      
      // Determine which days to include (monthly or weekly range)
      const allDates = Object.keys(daysWithHours);
      let filteredDates = allDates;

      if (paymentCycle === 'weekly' && week) {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDay = (Number(week) - 1) * 7 + 1;
        const endDay = Math.min(Number(week) * 7, daysInMonth);
        filteredDates = allDates.filter(dateStr => {
          const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
          return dayOfMonth >= startDay && dayOfMonth <= endDay;
        });
        console.log(`Weekly range for week ${week}: days ${startDay}-${endDay}, matching dates:`, filteredDates);
      } else if (paymentCycle === '15days' && half) {
        const daysInMonth = new Date(year, month, 0).getDate();
        const isFirstHalf = String(half) === '1';
        const startDay = isFirstHalf ? 1 : 16;
        const endDay = isFirstHalf ? 15 : daysInMonth;
        filteredDates = allDates.filter(dateStr => {
          const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
          return dayOfMonth >= startDay && dayOfMonth <= endDay;
        });
        console.log(`15-day range for half ${half}: days ${startDay}-${endDay}, matching dates:`, filteredDates);
      }

      // Calculate total days worked based on hours for the filtered range
      // Full day = 7+ hours, Half day = less than 7 hours
      filteredDates.forEach(dateStr => {
        const dayData = daysWithHours[dateStr];
        if (dayData.hoursWorked >= 7) {
          totalDaysWorked += 1;
          console.log(`${dateStr}: Full day (${dayData.hoursWorked.toFixed(2)} hours)`);
        } else if (dayData.hoursWorked > 0) {
          totalDaysWorked += 0.5;
          console.log(`${dateStr}: Half day (${dayData.hoursWorked.toFixed(2)} hours)`);
        }
      });
      
      console.log('Total days worked:', totalDaysWorked);
      console.log('Days with attendance:', Object.keys(daysWithHours));
    }
    
    // DIRECT UPDATE: Force the value into the input field
    const daysWorkedInput = document.getElementById('days-worked');
    
    // Set the value directly using multiple approaches to ensure it takes effect
    daysWorkedInput.value = totalDaysWorked;
    daysWorkedInput.setAttribute('value', totalDaysWorked);
    
    console.log('Set days worked to:', totalDaysWorked);
    
    // Force UI update and recalculation
    daysWorkedInput.dispatchEvent(new Event('input', { bubbles: true }));
    daysWorkedInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Force recalculation of totals
    if (typeof calculateGroceryComponents === 'function') calculateGroceryComponents();
    if (typeof calculateSalaryTotals === 'function') calculateSalaryTotals();
    
    return totalDaysWorked;
  } catch (error) {
    console.error('Error in autofillDaysWorked:', error);
    
    // Even on error, default to 0
    const daysWorkedInput = document.getElementById('days-worked');
    daysWorkedInput.value = 0;
    daysWorkedInput.setAttribute('value', 0);
    
    // Force UI update and recalculation
    daysWorkedInput.dispatchEvent(new Event('input', { bubbles: true }));
    daysWorkedInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    return 0;
  }
}

    employeeSelect.addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const basicSalary = selectedOption.getAttribute('data-basic-salary') || 0;
  const basicSalaryInput = document.getElementById('basic-salary');
  basicSalaryInput.value = basicSalary;
  basicSalaryInput.setAttribute('data-original-salary', basicSalary);

  // Initialize grocery components when employee is selected

  // Clear signature pad for new employee
  const employeeId = this.value;
  if (salarySigPad) {
    salarySigPad.clear();
  }

  // Calculate grocery components and update totals
  calculateGroceryComponents();
  calculateSalaryTotals();

  // Autofill Days Worked based on attendance calculation
  // Wait for Payment Cycle, Month, and Year before calculating
  if (employeeId) {
    const dw = document.getElementById('days-worked');
    if (dw) dw.value = '';
  } else {
    document.getElementById('days-worked').value = '';
  }
});
      
   
    // Add event listeners to amount inputs with improved debouncing to prevent lag when typing
    document.querySelectorAll('.earning-amount, .deduction-amount').forEach(input => {
      // Remove any existing input event listeners to prevent duplicates
      const newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);
      
      // Add debounced event listener with longer delay to prevent lag
      newInput.addEventListener('input', debounce(function() {
        // Mark as manual override and recalc totals
        this.setAttribute('data-manual', 'true');
        calculateSalaryTotals();
      }, 500)); // Increased debounce time for better performance
    });
    
    // Add event listener for days worked input
    // Using a different variable name to avoid conflicts
    const daysWorkedInputSingle = document.querySelector('#days-worked');
    if (daysWorkedInputSingle) {
      // Remove any existing listeners by cloning the node
      const newDaysWorkedInput = daysWorkedInputSingle.cloneNode(true);
      if (daysWorkedInputSingle.parentNode) {
        daysWorkedInputSingle.parentNode.replaceChild(newDaysWorkedInput, daysWorkedInputSingle);
      }
      
      // Add fresh event listener
      newDaysWorkedInput.addEventListener('input', function() {
        calculateGroceryComponents();
      });
    }
    
    // Initialize signature pad after modal is shown
    $('#generate-salary-modal').on('shown.bs.modal', function() {
      const canvas = document.getElementById('salary-signature-pad');
      if (canvas) {
        salarySigPad = new SignaturePad(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)'
        });
        
        // Adjust canvas size
        function resizeCanvas() {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext('2d').scale(ratio, ratio);
          salarySigPad.clear(); // Clear the canvas
        }
        
        // Set initial size
        resizeCanvas();
      }
    });
      
    // Add clear button functionality
      const clearButton = document.getElementById('clear-salary-signature-btn');
      if (clearButton) {
        clearButton.addEventListener('click', function() {
          if (salarySigPad) {
            salarySigPad.clear();
          }
        });
      }
    
    // Optimize the initial calculation
    setTimeout(() => {
      calculateSalaryTotals();
    }, 100);
    
    // Add event listeners for real-time updates
    const holidayPayInput = document.getElementById('holiday-pay-input');
    const daysWorkedInput = document.getElementById('days-worked');
    
    // Check if elements exist before proceeding
    if (holidayPayInput && daysWorkedInput) {
      // Remove any existing event listeners
      const newHolidayPayInput = holidayPayInput.cloneNode(true);
      const newDaysWorkedInput = daysWorkedInput.cloneNode(true);
      
      holidayPayInput.parentNode.replaceChild(newHolidayPayInput, holidayPayInput);
      daysWorkedInput.parentNode.replaceChild(newDaysWorkedInput, daysWorkedInput);
      
      // Add fresh event listeners with immediate calculation
      newHolidayPayInput.addEventListener('input', function() {
        calculateGroceryComponents();
      });
      
      newDaysWorkedInput.addEventListener('input', function() {
      calculateGroceryComponents();
    });
  }
  
  // Show the modal
  $('#generate-salary-modal').modal('show');
  } catch (error) {
    showNotification('Error loading data for salary generation', 'danger');
    console.error('Generate salary modal error:', error);
  }
}

// Calculate salary totals with optimized performance
function calculateSalaryTotals() {
  let totalEarnings = 0;
  let totalDeductions = 0;
  
  // Use more efficient selectors and caching
  const earningInputs = document.querySelectorAll('.earning-amount');
  const deductionInputs = document.querySelectorAll('.deduction-amount');
  
  // Calculate total earnings with optimized loop
  for (let i = 0; i < earningInputs.length; i++) {
    const amount = parseFloat(earningInputs[i].value) || 0;
    totalEarnings += amount;
  }
  
  // Calculate total deductions with optimized loop
  for (let i = 0; i < deductionInputs.length; i++) {
    const amount = parseFloat(deductionInputs[i].value) || 0;
    totalDeductions += amount;
  }
  
  // Calculate net salary
  const netSalary = totalEarnings - totalDeductions;
  
  // Cache DOM elements to avoid repeated lookups
  const totalEarningsElement = document.getElementById('total-earnings');
  const totalDeductionsElement = document.getElementById('total-deductions');
  const netSalaryElement = document.getElementById('net-salary');
  
  // Update totals
  totalEarningsElement.textContent = formatCurrency(totalEarnings);
  totalDeductionsElement.textContent = formatCurrency(totalDeductions);
  netSalaryElement.textContent = formatCurrency(netSalary);
}

// Auto-fill earning/deduction amounts based on percentage of basic salary.
function applyPercentageAutofill() {
  const basicSalaryInput = document.getElementById('basic-salary');
  const base = parseFloat(basicSalaryInput?.value) || 0;
  if (!basicSalaryInput) return;

  // Autofill earnings
  const earningInputs = document.querySelectorAll('.earning-amount');
  earningInputs.forEach(input => {
    const id = input.getAttribute('id') || '';
    if (id === 'basic-salary' || id === 'holiday-pay') return; // Skip base and holiday
    const manual = input.getAttribute('data-manual') === 'true';
    const valueType = input.getAttribute('data-value-type') || '';
    if (manual) return;
    if (valueType === 'amount') {
      const amtStr = input.getAttribute('data-amount') || '';
      const amt = parseFloat(amtStr);
      if (!isNaN(amt) && amt >= 0) {
        input.value = amt.toFixed(2);
      }
    } else {
      const pctStr = input.getAttribute('data-percentage') || '';
      const pct = parseFloat(pctStr);
      if (!isNaN(pct) && pct > 0) {
        input.value = ((base * pct) / 100).toFixed(2);
      }
    }
  });

  // Autofill deductions
  const deductionInputs = document.querySelectorAll('.deduction-amount');
  deductionInputs.forEach(input => {
    const manual = input.getAttribute('data-manual') === 'true';
    const valueType = input.getAttribute('data-value-type') || '';
    if (manual) return;
    if (valueType === 'amount') {
      const amtStr = input.getAttribute('data-amount') || '';
      const amt = parseFloat(amtStr);
      if (!isNaN(amt) && amt >= 0) {
        input.value = amt.toFixed(2);
      }
    } else {
      const pctStr = input.getAttribute('data-percentage') || '';
      const pct = parseFloat(pctStr);
      if (!isNaN(pct) && pct > 0) {
        input.value = ((base * pct) / 100).toFixed(2);
      }
    }
  });

  calculateSalaryTotals();
}

// Toggle percentage vs amount inputs in payhead modal
function updatePayheadValueTypeUI() {
  const select = document.getElementById('payhead-value-type');
  const pctGroup = document.getElementById('payhead-percentage-group');
  const amtGroup = document.getElementById('payhead-amount-group');
  const type = select ? select.value : 'percentage';
  if (pctGroup && amtGroup) {
    if (type === 'amount') {
      pctGroup.style.display = 'none';
      amtGroup.style.display = 'block';
    } else {
      pctGroup.style.display = 'block';
      amtGroup.style.display = 'none';
    }
  }
}

// Toggle week selection based on payment cycle
function toggleWeekSelection() {
  const paymentCycle = document.getElementById('payment-cycle').value;
  const weekSelectionContainer = document.getElementById('week-selection-container');
  const halfSelectionContainer = document.getElementById('half-selection-container');
  const daysWorkedInput = document.getElementById('days-worked');
  const weekEl = document.getElementById('salary-week');
  const halfEl = document.getElementById('salary-half');
  
  if (paymentCycle === 'weekly') {
    weekSelectionContainer.style.display = 'block';
    if (halfSelectionContainer) halfSelectionContainer.style.display = 'none';
    // Do not set a default value; just constrain input
    daysWorkedInput.max = 7;
    daysWorkedInput.placeholder = "Days (1-7)";
    if (weekEl) weekEl.required = true;
    if (halfEl) halfEl.required = false;
  } else {
    weekSelectionContainer.style.display = 'none';
    if (paymentCycle === '15days') {
      if (halfSelectionContainer) halfSelectionContainer.style.display = 'block';
      // Do not set a default value; just constrain input
      daysWorkedInput.max = 15;
      daysWorkedInput.placeholder = "Days (1-15)";
      if (weekEl) weekEl.required = false;
      if (halfEl) halfEl.required = true;
    } else {
      if (halfSelectionContainer) halfSelectionContainer.style.display = 'none';
      // Do not set a default value; just constrain input
      daysWorkedInput.max = 31;
      daysWorkedInput.placeholder = "Days (1-31)";
      if (weekEl) weekEl.required = false;
      if (halfEl) halfEl.required = false;
    }
  }
  
  // Recalculate grocery components when payment cycle changes
  calculateGroceryComponents();
  
  // Attempt days worked calculation if all required fields are set
  if (typeof triggerAutofillDaysWorked === 'function') {
    triggerAutofillDaysWorked();
  }
}

// Calculate grocery-specific components
function calculateGroceryComponents() {
  const basicSalaryInput = document.getElementById('basic-salary');
  const originalBasicSalary = parseFloat(basicSalaryInput.getAttribute('data-original-salary') || basicSalaryInput.value) || 0;
  const paymentCycle = document.getElementById('payment-cycle').value;
  
  // Get days worked
  const daysWorked = parseFloat(document.getElementById('days-worked').value) || 0;
  
  // Calculate daily rate
  const dailyRate = originalBasicSalary;
  
  // Calculate adjusted basic salary based on days worked
  let adjustedBasicSalary = dailyRate * daysWorked;
  
  // Get holiday pay directly from user input
  const holidayAmount = parseFloat(document.getElementById('holiday-pay-input').value) || 0;
  
  // Update basic salary input to reflect days worked only (NOT including holiday pay)
  basicSalaryInput.value = (dailyRate * daysWorked).toFixed(2);
  
  // Calculate hourly rate based on daily rate
  const hourlyRate = dailyRate / 8; // 8 hours per day
  
  // Add holiday pay as a separate earning component
  updateOrCreateComponentInput('holiday-pay', 'Holiday Pay', holidayAmount);
  
  // Autofill percentage-based components after basic salary changes
  applyPercentageAutofill();

  // Recalculate totals
  calculateSalaryTotals();
}

// Helper function to update or create component inputs
function updateOrCreateComponentInput(id, name, amount) {
  let input = document.getElementById(id);
  
  if (!input) {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label for="${id}">${name}</label>
      <input type="number" class="form-control earning-amount" id="${id}" data-id="${id}" data-name="${name}" placeholder="Amount" value="${amount.toFixed(2)}" readonly>
    `;
    document.getElementById('earnings-container').appendChild(div);
  } else {
    input.value = amount.toFixed(2);
  }
}

// Generate salary
async function generateSalary() {
  try {
    console.log('Starting salary generation process...');
    
    // Get form values
    const employeeId = document.getElementById('salary-employee').value;
    const month = document.getElementById('salary-gen-month').value;
    const year = document.getElementById('salary-gen-year').value;
    const paymentCycle = document.getElementById('payment-cycle').value;
    const week = paymentCycle === 'weekly' ? document.getElementById('salary-week').value : null;
    const half = paymentCycle === '15days' ? document.getElementById('salary-half').value : null;
    
    console.log('Form values:', { employeeId, month, year, paymentCycle, week, half });
    
    // Validate form
    if (!employeeId || !month || !year) {
      showNotification('Please select employee, month, and year', 'warning');
      return;
    }
    
    if (paymentCycle === 'weekly' && !week) {
      showNotification('Please select week for weekly payment', 'warning');
      return;
    }
    if (paymentCycle === '15days' && !half) {
      showNotification('Please select half for 15-day payment', 'warning');
      return;
    }
    
    // Prepare signature: prefer fresh pad, fallback to stored employee signature
    const employeesList = await window.api.getEmployees();
    const employeeRecord = employeesList.find(e => String(e.id) === String(employeeId));
    const employeeSignature = employeeRecord && employeeRecord.signature ? employeeRecord.signature : null;

    let signatureData = null;
    if (salarySigPad && !salarySigPad.isEmpty()) {
      signatureData = salarySigPad.toDataURL();
    } else if (employeeSignature) {
      signatureData = employeeSignature;
    }

    if (!signatureData) {
      showNotification('Employee signature is required before generating the payslip', 'warning');
      return;
    }
    
    // Check if signature verification is required and completed
    const signatureVerifiedCheckbox = document.getElementById('signature-verified');
    if (signatureVerifiedCheckbox && !signatureVerifiedCheckbox.checked) {
      showNotification('Please verify employee signature before generating payslip', 'warning');
      return;
    }
    
    // Collect payhead amounts
    const payheads = [];
    
    // Collect earnings (including basic salary)
    document.querySelectorAll('.earning-amount').forEach(input => {
      const amount = parseFloat(input.value) || 0;
      if (amount > 0) {
        payheads.push({
          id: input.getAttribute('data-id'),
          name: input.getAttribute('data-name'),
          type: 'earning',
          amount: amount
        });
      }
    });
    
    // Collect deductions
    document.querySelectorAll('.deduction-amount').forEach(input => {
      const amount = parseFloat(input.value) || 0;
      if (amount > 0) {
        payheads.push({
          id: input.getAttribute('data-id'),
          name: input.getAttribute('data-name'),
          type: 'deduction',
          amount: amount
        });
      }
    });
    
    // Ensure basic salary is included
    const basicSalaryInput = document.getElementById('basic-salary');
    const basicSalaryAmount = parseFloat(basicSalaryInput.value) || 0;
    
    // Use the computed basic salary directly for all cycles
    const adjustedBasicSalary = basicSalaryAmount;
    
    if (adjustedBasicSalary > 0) {
      // Check if basic salary is already in payheads
      const basicSalaryExists = payheads.some(p => p.name === 'Basic Salary');
      if (!basicSalaryExists) {
        // Add basic salary to payheads if not already included
        payheads.push({
          id: 'basic-salary',
          name: 'Basic Salary',
          type: 'earning',
          amount: adjustedBasicSalary
        });
      }
    }
    
    // Add grocery-specific components if they exist
    // Holiday Pay: avoid duplicate entries if already present among .earning-amount inputs
    const holidayPayInput = document.getElementById('holiday-pay-input');
    if (holidayPayInput) {
      const holidayAmount = parseFloat(holidayPayInput.value) || 0;
      const holidayExists = payheads.some(p => (
        p.id === 'holiday-pay' || (p.name || '').trim().toLowerCase() === 'holiday pay'
      ));
      if (holidayAmount > 0 && !holidayExists) {
        payheads.push({
          id: 'holiday-pay',
          name: 'Holiday Pay',
          type: 'earning',
          amount: holidayAmount
        });
      }
    }
    
    // Validate payheads
    if (payheads.length === 0) {
      showNotification('Please enter at least one payhead amount', 'warning');
      return;
    }
    
    console.log('Collected payheads:', payheads);
    
    // Generate salary
    // Check if salary already exists for this employee, month, year, and period (week/half)
    const existingSalaries = await window.api.getSalaries({ 
      employeeId, 
      month, 
      year,
      week,
      paymentCycle,
      half
    });
    
    console.log('Existing salaries check:', existingSalaries);

    
    // Capture Days Worked and Daily Rate for payslip display
    const daysWorkedVal = parseFloat((document.getElementById('days-worked')?.value) || 0) || 0;
    const basicSalaryEl = document.getElementById('basic-salary');
    const dailyRateVal = parseFloat((basicSalaryEl?.getAttribute('data-original-salary')) || (basicSalaryEl?.value) || 0) || 0;

    await window.api.generateSalary({
      employeeId,
      month,
      year,
      week,
      half,
      paymentCycle,
      payheads,
      signature: signatureData,
      daysWorked: daysWorkedVal,
      dailyRate: dailyRateVal
    });
    
    console.log('Salary generated and saved successfully');
    showNotification('Salary generated successfully', 'success');
    
    // Close modal
    $('#generate-salary-modal').modal('hide');
    
    // Reload salaries with a slight delay to ensure data is saved
    console.log('Reloading salaries after generation...');
    setTimeout(() => {
      loadSalaries();
      // Reload dashboard data
      loadDashboardData();
    }, 500);
  } catch (error) {
    showNotification('Error generating salary', 'danger');
    console.error('Generate salary error:', error);
  }
}

// Load salaries
async function loadSalaries() {
  try {
    console.log('loadSalaries function called');
    
    // Make sure window.api is available
    if (!window.api) {
      console.error('window.api is not available');
      showNotification('API not initialized properly', 'danger');
      return;
    }
    
    // Try-catch specifically for the getSalaries call
    let salaries = [];
    try {
      salaries = await window.api.getSalaries({});  // Pass empty object as filters
      console.log('Loaded salaries:', salaries); // Debug log
    } catch (salaryError) {
      console.error('Error fetching salaries:', salaryError);
      showNotification('Error loading salary data', 'danger');
      return;
    }
    
    // Try-catch specifically for the getEmployees call
    let employees = [];
    try {
      employees = await window.api.getEmployees();
      console.log('Loaded employees:', employees); // Debug log
    } catch (employeeError) {
      console.error('Error fetching employees:', employeeError);
      showNotification('Error loading employee data', 'danger');
      return;
    }
    
    if (!salaries || salaries.length === 0) {
      console.warn('No salaries returned from API call');
    }
    
    const tableBody = document.getElementById('salary-list');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Add salary rows
    if (salaries && salaries.length > 0) {
      salaries.forEach(salary => {
        // Find employee
        const employee = employees.find(emp => String(emp.id) === String(salary.employeeId));
        const employeeName = employee ? employee.name : 'Unknown';
        
        console.log('Adding salary row for:', employeeName, salary); // Debug log
        
        // Create row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="checkbox" class="salary-select" data-id="${salary.id}"></td>
          <td>${employeeName}</td>
          <td>${getMonthName(salary.month)}</td>
          <td>${salary.year}</td>
          <td>${salary.paymentCycle || '-'}</td>
          <td>${
            salary.paymentCycle === 'weekly' && salary.week
              ? 'Week ' + salary.week
              : (salary.paymentCycle === '15days' && (salary.half === 1 || salary.half === '1' || salary.half === 2 || salary.half === '2'))
                ? (String(salary.half) === '1' ? 'First Half' : 'Second Half')
                : '-'
          }</td>
          <td>${formatCurrency(salary.totalEarnings)}</td>
          <td>${formatCurrency(salary.totalDeductions)}</td>
          <td>${formatCurrency(salary.netSalary)}</td>
          <td>
            <div class="salary-actions">
              <button class="salary-action-btn view-salary" data-id="${salary.id}"><i class="fas fa-eye"></i></button>
              <button class="salary-action-btn salary-delete-btn delete-salary" data-id="${salary.id}"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      console.log('No salaries found to display'); // Debug log
      // Add a message row when no salaries are found
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="10" class="text-center">No salary records found</td>
      `;
      tableBody.appendChild(row);
    }
    
    // Add event listeners to view buttons
    document.querySelectorAll('.view-salary').forEach(button => {
      button.addEventListener('click', function() {
        const salaryId = this.getAttribute('data-id');
        viewSalary(salaryId, salaries, employees);
      });
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-salary').forEach(button => {
      button.addEventListener('click', async function() {
        const salaryId = this.getAttribute('data-id');
        showCustomDialog({
          title: 'Delete Salary',
          message: 'Are you sure you want to delete this salary record?',
          onConfirm: async () => {
            try {
              await window.api.deleteSalary(salaryId);
              showNotification('Salary deleted successfully', 'success');
              loadSalaries(); // Reload the salary list
            } catch (error) {
              console.error('Error deleting salary:', error);
              showNotification('Error deleting salary', 'danger');
            }
          }
        });
      });
    });

    // Attach multi-select listeners and update counts
    attachSalarySelectionListeners();
    updateSelectedCount();
    updateSelectAllState();

    // Apply active text search (if any) to freshly loaded rows
    searchSalaries();
  } catch (error) {
    showNotification('Error loading salaries', 'danger');
    console.error('Salaries error:', error);
  }
}

// Filter salaries by month and year
function getSelectedSalaryIds() {
  return Array.from(document.querySelectorAll('.salary-select:checked')).map(cb => cb.getAttribute('data-id'));
}

function updateSelectedCount() {
  const el = document.getElementById('selected-count');
  if (el) {
    el.textContent = `${getSelectedSalaryIds().length} selected`;
  }
}

function updateSelectAllState() {
  const selectAll = document.getElementById('salary-select-all');
  if (!selectAll) return;
  const checkboxes = Array.from(document.querySelectorAll('.salary-select'));
  const total = checkboxes.length;
  const checked = checkboxes.filter(cb => cb.checked).length;
  selectAll.indeterminate = checked > 0 && checked < total;
  selectAll.checked = total > 0 && checked === total;
}

function attachSalarySelectionListeners() {
  document.querySelectorAll('.salary-select').forEach(cb => {
    cb.addEventListener('change', () => {
      updateSelectedCount();
      updateSelectAllState();
    });
  });

  const selectAll = document.getElementById('salary-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const checked = selectAll.checked;
      document.querySelectorAll('.salary-select').forEach(cb => (cb.checked = checked));
      updateSelectedCount();
      updateSelectAllState();
    });
  }
}

async function deleteSelectedSalaries() {
  const ids = getSelectedSalaryIds();
  if (ids.length === 0) {
    showNotification('No salary record selected', 'warning');
    return;
  }
  showCustomDialog({
    title: 'Delete Salaries',
    message: `Delete ${ids.length} selected salary record(s)?`,
    onConfirm: async () => {
      try {
        for (const id of ids) {
          await window.api.deleteSalary(id);
        }
        showNotification('Selected salaries deleted', 'success');
        loadSalaries();
      } catch (error) {
        console.error('Bulk delete error:', error);
        showNotification('Error deleting selected salaries', 'danger');
      }
    }
  });
}

function buildPayslipHTML(salary, employee, currencySymbol, companyName, companyAddress, signatureData) {
  const salaryDate = `${getMonthName(salary.month)} ${salary.year}`;
  const sortedEarnings = [...salary.payheads.filter(p => p.type === 'earning')].sort((a, b) => {
    if (a.name === 'Basic Salary') return -1;
    if (b.name === 'Basic Salary') return 1;
    return 0;
  });
  
  // Prepend Days Worked and Rate per Day to the earnings table if provided
  const infoRows = [];
  if (salary && salary.daysWorked != null) {
    infoRows.push({ name: 'Days Worked', amount: Number(salary.daysWorked), isInfo: 'days' });
  }
  if (salary && salary.dailyRate != null) {
    infoRows.push({ name: 'Rate per Day', amount: Number(salary.dailyRate), isInfo: 'rate' });
  }
  const displayEarnings = [...infoRows, ...sortedEarnings];
  return `
    <div class="payslip-container">
      <div class="payslip-header">
        <h3>${companyName}</h3>
        <p>${companyAddress}</p>
        <h4>Salary Slip - ${
          salary.paymentCycle === 'weekly' && salary.week
            ? `Week ${salary.week}, `
            : (salary.paymentCycle === '15days' && (salary.half === 1 || salary.half === '1' || salary.half === 2 || salary.half === '2'))
              ? `${String(salary.half) === '1' ? 'First Half' : 'Second Half'}, `
              : ''
        }${salaryDate}</h4>
      </div>
      <div class="payslip-info">
        <div class="info-row">
          <div class="info-label">Employee:</div>
          <div class="info-value">${employee ? employee.name : 'Unknown'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Department:</div>
          <div class="info-value">${employee ? employee.department : ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Position:</div>
          <div class="info-value">${employee ? employee.designation : ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Employee ID:</div>
          <div class="info-value">${employee ? employee.id : ''}</div>
        </div>
      </div>
      <div class="payslip-section">
        <div class="section-title">Earnings</div>
        <table class="payslip-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${displayEarnings.map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${p.isInfo === 'days' 
                    ? `${Number(p.amount)}` 
                    : `${currencySymbol}${Number(p.amount).toFixed(2)}`}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total Earnings</td>
              <td>${currencySymbol}${salary.totalEarnings.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="payslip-section">
        <div class="section-title">Deductions</div>
        <table class="payslip-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${salary.payheads.filter(p => p.type === 'deduction').map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${currencySymbol}${p.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total Deductions</td>
              <td>${currencySymbol}${salary.totalDeductions.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="payslip-footer">
        <div class="net-salary">
          <div class="salary-label">Net Salary:</div>
          <div class="salary-amount">${currencySymbol}${salary.netSalary.toFixed(2)}</div>
        </div>
        ${signatureData ? `
        <div class="signature-container">
          <div class="signature-image">
            <img src="${signatureData}" alt="${employee ? employee.name : 'Employee'}'s Signature" style="max-height: 60px;">
          </div>
          <div class="signature-name">${employee ? employee.name : ''}</div>
        </div>
        ` : ''}
      </div>
    </div>`;
}

async function bulkPrintSelectedSalaries() {
  const ids = getSelectedSalaryIds();
  if (ids.length === 0) {
    showNotification('Select salary records to print', 'warning');
    return;
  }
  try {
    const salaries = await window.api.getSalaries({});
    const employees = await window.api.getEmployees();

    const companyName = localStorage.getItem('companyName') || 'Electron Payroll';
    const companyAddress = localStorage.getItem('companyAddress') || '';
    const currencySymbol = localStorage.getItem('currencySymbol') || '₱';

    const contentEl = document.getElementById('salary-slip-content');
    contentEl.innerHTML = '';

    ids.forEach(id => {
      const salary = salaries.find(s => s.id === id);
      if (!salary) return;
      const employee = employees.find(emp => emp.id === salary.employeeId);
      const signatureData = (salary && salary.signature) || (employee && employee.signature) || null;
      const html = buildPayslipHTML(salary, employee, currencySymbol, companyName, companyAddress, signatureData);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      contentEl.appendChild(wrapper.firstElementChild);
    });

    $('#salary-slip-modal').modal('show');
    const printBtn = document.getElementById('print-salary-slip-btn');
    if (printBtn) {
      // Use the shared print preview flow like reports
      printBtn.onclick = () => showPrintPreview();
    }
  } catch (error) {
    console.error('Bulk print error:', error);
    showNotification('Nagka-error sa bulk print', 'danger');
  }
}

async function filterSalaries() {
  try {
    const month = document.getElementById('salary-month').value;
    const year = document.getElementById('salary-year').value;
    
    // Validate filters
    if (!month || !year) {
      showNotification('Please select month and year', 'warning');
      return;
    }
    
    // Get filtered salaries
    const salaries = await window.api.getSalaries({ month, year });
    const employees = await window.api.getEmployees();
    const tableBody = document.getElementById('salary-list');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (salaries.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="10" class="text-center">No salaries found for the selected period</td></tr>';
      return;
    }
    
    // Add salary rows
    salaries.forEach(salary => {
      // Find employee
      const employee = employees.find(emp => emp.id === salary.employeeId);
      const employeeName = employee ? employee.name : 'Unknown';
      
      // Create row
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="salary-select" data-id="${salary.id}"></td>
        <td>${employeeName}</td>
        <td>${getMonthName(salary.month)}</td>
        <td>${salary.year}</td>
        <td>${salary.paymentCycle || '-'}</td>
        <td>${
          salary.paymentCycle === 'weekly' && salary.week
            ? 'Week ' + salary.week
            : (salary.paymentCycle === '15days' && (salary.half === 1 || salary.half === '1' || salary.half === 2 || salary.half === '2'))
              ? (String(salary.half) === '1' ? 'First Half' : 'Second Half')
              : '-'
        }</td>
        <td>${formatCurrency(salary.totalEarnings)}</td>
        <td>${formatCurrency(salary.totalDeductions)}</td>
        <td>${formatCurrency(salary.netSalary)}</td>
        <td>
          <div class="salary-actions">
            <button class="salary-action-btn view-salary" data-id="${salary.id}"><i class="fas fa-eye"></i></button>
            <button class="salary-action-btn salary-delete-btn delete-salary" data-id="${salary.id}"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
    
    // Add event listeners to view and delete buttons
    document.querySelectorAll('.view-salary').forEach(button => {
      button.addEventListener('click', function() {
        const salaryId = this.getAttribute('data-id');
        viewSalary(salaryId, salaries, employees);
      });
    });
    document.querySelectorAll('.delete-salary').forEach(button => {
      button.addEventListener('click', async function() {
        const salaryId = this.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this salary record?')) {
          try {
            await window.api.deleteSalary(salaryId);
            showNotification('Salary deleted successfully', 'success');
            filterSalaries(); // Reload filtered list to preserve current filters
          } catch (error) {
            console.error('Error deleting salary:', error);
            showNotification('Error deleting salary', 'danger');
          }
        }
      });
    });

    // Reattach selection listeners and synchronize selection UI state
    attachSalarySelectionListeners();
    updateSelectedCount();
    updateSelectAllState();

    // Apply active text search on filtered result set
    searchSalaries();

  } catch (error) {
    showNotification('Error filtering salaries', 'danger');
    console.error('Filter salaries error:', error);
  }
}

// View salary slip
function viewSalary(salaryId, salaries, employees) {
  const salary = salaries.find(s => s.id === salaryId);
  if (!salary) return;

  const employee = employees.find(emp => String(emp.id) === String(salary.employeeId));

  const companyName = localStorage.getItem('companyName') || 'Electron Payroll';
  const companyAddress = localStorage.getItem('companyAddress') || '';
  const currencySymbol = localStorage.getItem('currencySymbol') || '₱';
  const signatureData = (salary && salary.signature) ? salary.signature : (employee && employee.signature ? employee.signature : null);

  const salarySlipContent = document.getElementById('salary-slip-content');
  // Render a single payslip using the shared template for consistency
  salarySlipContent.innerHTML = buildPayslipHTML(
    salary,
    employee,
    currencySymbol,
    companyName,
    companyAddress,
    signatureData
  );

  // Show modal (Bootstrap/jQuery)
  $('#salary-slip-modal').modal('show');

  // Add print event listener once to avoid stacking
  const printBtn = document.getElementById('print-salary-slip-btn');
  if (printBtn) {
    // Use the same print preview experience as reports
    printBtn.addEventListener('click', function() {
      showPrintPreview();
    }, { once: true });
  }

  // Remove delete button if it exists
  const deleteBtn = document.querySelector('#salary-slip-modal .delete-btn');
  if (deleteBtn) {
    deleteBtn.remove();
  }
}

// Delete salary
async function deleteSalary(salaryId) {
  if (confirm('Are you sure you want to delete this salary record?')) {
    try {
      // Call the API to delete the salary record
      await window.api.deleteSalary(salaryId);
      showNotification('Salary record deleted successfully', 'success');
      
      // Reload salaries
      loadSalaries();
      
      // Reload dashboard data
      loadDashboardData();
    } catch (error) {
      showNotification('Error deleting salary record', 'danger');
      console.error('Delete salary error:', error);
    }
  }
}

// Load settings
function loadSettings() {
  // Load company settings
  document.getElementById('company-name').value = localStorage.getItem('companyName') || '';
  document.getElementById('company-address').value = localStorage.getItem('companyAddress') || '';
  document.getElementById('company-email').value = localStorage.getItem('companyEmail') || '';
  document.getElementById('company-phone').value = localStorage.getItem('companyPhone') || '';
  
  // Load app settings
  document.getElementById('currency-symbol').value = localStorage.getItem('currencySymbol') || '₱';
  document.getElementById('date-format').value = localStorage.getItem('dateFormat') || 'MM/DD/YYYY';
  document.getElementById('dark-mode').checked = localStorage.getItem('darkMode') === 'true';
  
  // Apply dark mode if enabled
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
}

// Save company settings
function saveCompanySettings(e) {
  e.preventDefault();
  
  // Get form values
  const companyName = document.getElementById('company-name').value;
  const companyAddress = document.getElementById('company-address').value;
  const companyEmail = document.getElementById('company-email').value;
  const companyPhone = document.getElementById('company-phone').value;
  
  // Save to local storage
  localStorage.setItem('companyName', companyName);
  localStorage.setItem('companyAddress', companyAddress);
  localStorage.setItem('companyEmail', companyEmail);
  localStorage.setItem('companyPhone', companyPhone);
  
  showNotification('Company settings saved successfully', 'success');
}

// Save app settings
function saveAppSettings(e) {
  e.preventDefault();
  
  // Get form values
  const currencySymbol = document.getElementById('currency-symbol').value;
  const dateFormat = document.getElementById('date-format').value;
  const darkMode = document.getElementById('dark-mode').checked;
  
  // Save to local storage
  localStorage.setItem('currencySymbol', currencySymbol);
  localStorage.setItem('dateFormat', dateFormat);
  localStorage.setItem('darkMode', darkMode);
  
  // Apply dark mode
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  showNotification('Application settings saved successfully', 'success');
}

// Toggle dark mode
function toggleDarkMode() {
  const darkMode = document.getElementById('dark-mode').checked;
  
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  localStorage.setItem('darkMode', darkMode);
}

// Display employee signature for verification in salary generation
// Function removed as signature verification is now done directly in the salary modal

// Format currency
function formatCurrency(amount) {
  const currencySymbol = localStorage.getItem('currencySymbol') || '₱';
  // Ensure amount is a valid number
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${currencySymbol}${validAmount.toFixed(2)}`;
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '';
  
  const dateFormat = localStorage.getItem('dateFormat') || 'MM/DD/YYYY';
  return moment(dateString).format(dateFormat);
}

// Format date for input field
function formatDateForInput(dateString) {
  if (!dateString) return '';
  
  return moment(dateString).format('YYYY-MM-DD');
}

// Get month name
function getMonthName(monthNumber) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[parseInt(monthNumber) - 1] || '';
}

// Show notification
function showNotification(message, type) {
  $.notify({
    message: message
  }, {
    type: type,
    placement: {
      from: 'top',
      align: 'right'
    },
    z_index: 9999,
    delay: 3000,
    animate: {
      enter: 'animated fadeInDown',
      exit: 'animated fadeOutUp'
    }
  });
}

// Improved debounce function to limit how often a function can be called
// This helps prevent lag when typing in form fields
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    
    // For immediate visual feedback on first input, run with minimal delay
    // but then use the full debounce time for subsequent inputs
    const delay = timeout === undefined ? 10 : wait;
    
    timeout = setTimeout(() => {
      timeout = undefined;
      func.apply(context, args);
    }, delay);
  };
}

// --- Enhanced Employee Search Function ---
function searchEmployees(filterType = '', filterValue = '') {
  try {
    const rows = document.querySelectorAll('#employees-table tbody tr');
    if (!rows || rows.length === 0) {
      console.log('No employee rows found to search');
      return;
    }
    // Get search filter
    const searchInput = document.getElementById('employee-search');
    const searchFilter = searchInput ? searchInput.value.toLowerCase() : '';
    console.log('Searching employees for:', searchFilter || '(none)');
    // Track counts for stats
    let visibleCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    let leaveCount = 0;
    let totalCount = rows.length;
    // Apply search filter to each row
    rows.forEach(row => {
      // Get cell values for detailed filtering
      const employeeId = row.cells[0]?.textContent?.toLowerCase() || '';
      const name = row.cells[1]?.textContent || '';
      const department = row.cells[2]?.textContent?.toLowerCase() || '';
      const product = row.cells[3]?.textContent?.toLowerCase() || '';
      // Use status from cell (which is now from employee.status)
      let status = row.cells[4]?.textContent?.toLowerCase() || 'inactive';
      // Normalize status for filtering
      if (!['active', 'inactive', 'onleave', 'leave'].includes(status)) {
        status = 'inactive';
      }
      // Count by status for stats cards
      if (status === 'active') activeCount++;
      else if (status === 'inactive') inactiveCount++;
      else if (status === 'onleave' || status === 'leave') leaveCount++;
      // Check if row matches search criteria
      const matchesSearch = searchFilter === '' || 
                           employeeId.includes(searchFilter) || 
                           name.toLowerCase().includes(searchFilter) || 
                           department.includes(searchFilter) || 
                           product.includes(searchFilter) || 
                           status.includes(searchFilter);
      // Check if row matches specific filter criteria
      let matchesFilter = true;
      if (filterType === 'department') {
        matchesFilter = department.includes(filterValue?.toLowerCase() || '');
      } else if (filterType === 'status') {
        if (!filterValue || filterValue.toLowerCase() === 'all') {
          matchesFilter = true;
        } else {
          matchesFilter = status === filterValue.toLowerCase();
        }
      } else if (filterType === 'active-employee') {
        matchesFilter = status === 'active';
      }
      // Show/hide row based on filters
      const shouldShow = matchesSearch && matchesFilter;
      row.style.display = shouldShow ? '' : 'none';
      if (shouldShow) visibleCount++;
    });
    // Update UI elements
    updateEmployeeStats(totalCount, activeCount, inactiveCount, leaveCount);
    updateEmptyState(visibleCount);
    updatePaginationInfo(visibleCount, totalCount);
  } catch (error) {
    console.error('Error in searchEmployees:', error);
  }
}

// Salary search: filters the salary list table rows based on the text query
function searchSalaries() {
  try {
    const input = document.getElementById('salary-search');
    const query = (input && input.value ? input.value : '').toLowerCase().trim();

    const rows = document.querySelectorAll('#salary-list tr');
    let visibleCount = 0;

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');

      // Skip the message row (e.g., "No salary records found")
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
        // Hide message row during active search; will be handled by loadSalaries when empty
        row.style.display = query ? 'none' : '';
        return;
      }

      const employee = (cells[1] ? cells[1].textContent : '').toLowerCase();
      const month = (cells[2] ? cells[2].textContent : '').toLowerCase();
      const year = (cells[3] ? cells[3].textContent : '').toLowerCase();
      const cycle = (cells[4] ? cells[4].textContent : '').toLowerCase();
      const week = (cells[5] ? cells[5].textContent : '').toLowerCase();
      const totalEarnings = (cells[6] ? cells[6].textContent : '').toLowerCase();
      const totalDeductions = (cells[7] ? cells[7].textContent : '').toLowerCase();
      const netSalary = (cells[8] ? cells[8].textContent : '').toLowerCase();

      const matches = !query || [
        employee,
        month,
        year,
        cycle,
        week,
        totalEarnings,
        totalDeductions,
        netSalary
      ].some(text => text.includes(query));

      row.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });

    // Toggle optional "no results" helper if present
    const noMsg = document.getElementById('no-salaries-message');
    if (noMsg) {
      noMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Salary search error:', error);
  }
}

// Function to update employee stats cards
function updateEmployeeStats(total, active, inactive, leave) {
  try {
    const activeElement = document.getElementById('active-count');
    const inactiveElement = document.getElementById('inactive-count');
    const leaveElement = document.getElementById('leave-count');
    
    if (activeElement) activeElement.textContent = active;
    if (inactiveElement) inactiveElement.textContent = inactive;
    if (leaveElement) leaveElement.textContent = leave;
  } catch (error) {
    console.error('Error updating employee stats:', error);
  }
}

// Function to show/hide empty state message
function updateEmptyState(visibleCount) {
  try {
    const tableContainer = document.querySelector('.employee-table-container');
    const emptyState = document.querySelector('.table-empty-state');
    
    if (emptyState) {
      if (visibleCount === 0) {
        emptyState.style.display = 'flex';
        if (tableContainer) tableContainer.classList.add('empty');
      } else {
        emptyState.style.display = 'none';
        if (tableContainer) tableContainer.classList.remove('empty');
      }
    }
  } catch (error) {
    console.error('Error updating empty state:', error);
  }
}

// Function to update pagination information
function updatePaginationInfo(visible, total) {
  try {
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${visible} of ${total} employees`;
    }
  } catch (error) {
    console.error('Error updating pagination info:', error);
  }
}

// Function to update department dropdown with dynamic departments from employee data
function updateDepartmentDropdown(employees) {
  try {
    const departmentDropdown = document.getElementById('department-dropdown');
    if (!departmentDropdown) {
      console.error('Department dropdown not found');
      return;
    }
    
    // Extract unique departments from employees
    const departments = new Set();
    employees.forEach(employee => {
      if (employee && employee.department) {
        departments.add(employee.department.trim());
      }
    });
    
    // Sort departments alphabetically
    const sortedDepartments = Array.from(departments).sort();
    
    // Keep the 'All Departments' option
    let dropdownHTML = '<div class="dropdown-item active" data-value="all">All Departments</div>';
    
    // Add department options
    sortedDepartments.forEach(department => {
      dropdownHTML += `<div class="dropdown-item" data-value="${department}">${department}</div>`;
    });
    
    // Update dropdown content
    departmentDropdown.innerHTML = dropdownHTML;
    
    // Reattach event listeners to department items
    const departmentFilter = document.querySelector('.quick-filter-btn[data-filter="department"]');
    const departmentItems = departmentDropdown.querySelectorAll('.dropdown-item');
    
    if (departmentFilter) {
      // Handle department dropdown item clicks
      departmentItems.forEach(item => {
        item.addEventListener('click', function() {
          const value = this.getAttribute('data-value');
          const text = this.textContent;
          
          // Update button text if not 'all'
          if (value !== 'all') {
            departmentFilter.querySelector('span').textContent = text;
            departmentFilter.classList.add('active');
          } else {
            departmentFilter.querySelector('span').textContent = 'Department';
            departmentFilter.classList.remove('active');
          }
          
          // Set this item as active
          departmentItems.forEach(i => i.classList.remove('active'));
          this.classList.add('active');
          
          // Close dropdown
          this.closest('.filter-dropdown').classList.remove('open');
          
          // Filter employees
          searchEmployees('department', value === 'all' ? null : value);
        });
      });
    }
    
    console.log(`Updated department dropdown with ${sortedDepartments.length} departments`);
  } catch (error) {
    console.error('Error updating department dropdown:', error);
  }
}

// Populate Add/Edit Employee Department datalist with existing departments
function updateDepartmentDatalist(employees) {
  try {
    const datalist = document.getElementById('existing-department-list');
    if (!datalist) return;
    const departments = new Set();
    const list = Array.isArray(employees) ? employees : [];
    list.forEach(emp => {
      if (emp && emp.department) departments.add(emp.department.trim());
    });
    // Fallback: populate from static department filter items if no employees available
    if (departments.size === 0) {
      const staticItems = document.querySelectorAll('#department-dropdown .dropdown-item');
      staticItems.forEach(item => {
        const value = item.getAttribute('data-value');
        const text = item.textContent?.trim();
        if (value && value.toLowerCase() !== 'all') {
          departments.add(text || value);
        }
      });
    }
    const options = Array.from(departments)
      .sort()
      .map(dep => `<option value="${dep}"></option>`)
      .join('');
    datalist.innerHTML = options;

    // Also initialize custom suggestions for Department input
    initDepartmentSuggestions();
  } catch (err) {
    console.error('Error updating department datalist:', err);
  }
}

// Initialize custom suggestions dropdown for Department field
function initDepartmentSuggestions() {
  try {
    const input = document.getElementById('employee-department');
    const list = document.getElementById('existing-department-list');
    const dropdown = document.getElementById('department-suggestions');
    if (!input || !list || !dropdown) return;

    // Build suggestions from datalist options
    const suggestions = Array.from(list.querySelectorAll('option'))
      .map(opt => opt.value || opt.textContent)
      .filter(Boolean)
      .sort();

    let activeIndex = -1;

    const render = (filter = '') => {
      const q = (filter || '').toLowerCase();
      const matched = suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
      dropdown.innerHTML = matched.map(s => `<div class="dept-item" role="option">${s}</div>`).join('');
      dropdown.classList.toggle('open', matched.length > 0);
      activeIndex = -1;
      // Attach click listeners
      dropdown.querySelectorAll('.dept-item').forEach((item, idx) => {
        item.addEventListener('mousedown', e => { // use mousedown to avoid blur cancel
          e.preventDefault();
          input.value = item.textContent;
          dropdown.classList.remove('open');
        });
      });
    };

    // Event handlers
    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.dept-item');
      if (!items.length || !dropdown.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          input.value = items[activeIndex].textContent;
          dropdown.classList.remove('open');
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        return;
      } else {
        return; // other keys handled by input
      }
      // Update active item styles
      items.forEach(i => i.classList.remove('active'));
      if (activeIndex >= 0) items[activeIndex].classList.add('active');
    });

    input.addEventListener('blur', () => {
      // Delay hiding to allow click selection
      setTimeout(() => dropdown.classList.remove('open'), 150);
    });
  } catch (err) {
    console.error('Error initializing department suggestions:', err);
  }
}

// Initialize custom suggestions dropdown for Position field (matches Department design)
function initPositionSuggestions() {
  try {
    const input = document.getElementById('employee-designation');
    const list = document.getElementById('position-options');
    const dropdown = document.getElementById('position-suggestions');
    if (!input || !list || !dropdown) return;

    // Build suggestions from datalist options
    const suggestions = Array.from(list.querySelectorAll('option'))
      .map(opt => opt.value || opt.textContent)
      .filter(Boolean)
      .sort();

    let activeIndex = -1;

    const render = (filter = '') => {
      const q = (filter || '').toLowerCase();
      const matched = suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
      dropdown.innerHTML = matched.map(s => `<div class="dept-item" role="option">${s}</div>`).join('');
      dropdown.classList.toggle('open', matched.length > 0);
      activeIndex = -1;
      // Attach click listeners
      dropdown.querySelectorAll('.dept-item').forEach((item, idx) => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          input.value = item.textContent;
          dropdown.classList.remove('open');
        });
      });
    };

    // Event handlers
    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.dept-item');
      if (!items.length || !dropdown.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          input.value = items[activeIndex].textContent;
          dropdown.classList.remove('open');
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        return;
      } else {
        return;
      }
      items.forEach(i => i.classList.remove('active'));
      if (activeIndex >= 0) items[activeIndex].classList.add('active');
    });

    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('open'), 150);
    });
  } catch (err) {
    console.error('Error initializing position suggestions:', err);
  }
}

// --- Employee Search Filtering ---
document.addEventListener('DOMContentLoaded', function() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.filter-dropdown')) {
      document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        dropdown.classList.remove('open');
      });
    }
  });
  // Employee search input
  const employeeSearch = document.getElementById('employee-search');
  if (employeeSearch) {
    employeeSearch.addEventListener('input', debounce(function() {
      searchEmployees();
    }, 300));
  }
  
  // Department filter dropdown
  const departmentFilter = document.querySelector('.quick-filter-btn[data-filter="department"]');
  
  if (departmentFilter) {
    // Only add click event to toggle dropdown visibility
    // The item click events are handled in updateDepartmentDropdown
    departmentFilter.addEventListener('click', function(e) {
      e.stopPropagation();
      // Close all other dropdowns
      document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        if (dropdown !== this.closest('.filter-dropdown')) {
          dropdown.classList.remove('open');
        }
      });
      
      // Toggle dropdown
      this.closest('.filter-dropdown').classList.toggle('open');
    });
  }
  
  // Status filter dropdown
  const statusFilter = document.querySelector('.quick-filter-btn[data-filter="status"]');
  const statusDropdown = document.getElementById('status-dropdown');
  const statusItems = statusDropdown ? statusDropdown.querySelectorAll('.dropdown-item') : [];
  
  if (statusFilter) {
    statusFilter.addEventListener('click', function(e) {
      e.stopPropagation();
      // Close all other dropdowns
      document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        if (dropdown !== this.closest('.filter-dropdown')) {
          dropdown.classList.remove('open');
        }
      });
      
      // Toggle dropdown
      this.closest('.filter-dropdown').classList.toggle('open');
    });
    
    // Handle status dropdown item clicks
    statusItems.forEach(item => {
      item.addEventListener('click', function() {
        const value = this.getAttribute('data-value');
        const text = this.textContent;
        
        // Update button text if not 'all'
        if (value !== 'all') {
          statusFilter.querySelector('span').textContent = text;
          statusFilter.classList.add('active');
        } else {
          statusFilter.querySelector('span').textContent = 'Status';
          statusFilter.classList.remove('active');
        }
        
        // Set this item as active
        statusItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        // Close dropdown
        this.closest('.filter-dropdown').classList.remove('open');
        
        // Filter employees
        searchEmployees('status', value === 'all' ? null : value);
      });
    });
  }
  
  // Active employees filter
  const activeFilter = document.querySelector('.quick-filter-btn[data-filter="active-employee"]');
  if (activeFilter) {
    activeFilter.addEventListener('click', function() {
      // Toggle active class
      this.classList.toggle('active');
      
      // Filter to show only active employees
      searchEmployees('active-employee');
    });
  }
  
  // Initialize employee stats and pagination
  searchEmployees();

  // Salary search input
  const salarySearch = document.getElementById('salary-search');
  if (salarySearch) {
    salarySearch.addEventListener('input', debounce(function() {
      searchSalaries();
    }, 300));
  }
});

// Backup and Restore Functions
async function handleExportBackup() {
  try {
    const exportBtn = document.getElementById('export-backup-btn');
    const originalText = exportBtn.textContent;
    
    // Show loading state
    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;
    
    const result = await window.api.exportBackup();
    
    if (result.success) {
      showNotification('Backup exported successfully!', 'success');
    } else {
      showNotification(result.error || 'Failed to export backup', 'error');
    }
  } catch (error) {
    console.error('Export backup error:', error);
    showNotification('Failed to export backup', 'error');
  } finally {
    // Reset button state
    const exportBtn = document.getElementById('export-backup-btn');
    exportBtn.textContent = 'Export Backup';
    exportBtn.disabled = false;
  }
}

// Cloud Backup (Supabase)
async function handleExportCloudBackup() {
  const btn = document.getElementById('export-cloud-backup-btn');
  if (!btn) return;
  try {
    if (!window.supabase || !window.supabase.from) {
      showNotification('Supabase is not initialized', 'danger');
      return;
    }
    const originalText = btn.textContent;
    btn.textContent = 'Uploading...';
    btn.disabled = true;

    const snapRes = await window.api.getBackupSnapshot();
    if (!snapRes || !snapRes.success) {
      throw new Error(snapRes && snapRes.message ? snapRes.message : 'Failed to build snapshot');
    }

    const payload = {
      created_at: new Date().toISOString(),
      data: snapRes.snapshot
    };

    const { data, error } = await window.supabase
      .from('backups')
      .insert([payload])
      .select();

    if (error) throw error;
    showNotification('Cloud backup uploaded successfully', 'success');
  } catch (error) {
    console.error('Cloud export error:', error);
    showNotification('Failed to upload cloud backup: ' + (error.message || 'unknown error'), 'danger');
  } finally {
    const btn = document.getElementById('export-cloud-backup-btn');
    if (btn) {
      btn.textContent = 'Export to Cloud';
      btn.disabled = false;
    }
  }
}

async function handleImportCloudBackup() {
  const btn = document.getElementById('import-cloud-backup-btn');
  if (!btn) return;
  try {
    if (!window.supabase || !window.supabase.from) {
      showNotification('Supabase is not initialized', 'danger');
      return;
    }
    const proceed = typeof window.confirm === 'function'
      ? window.confirm('Restore from cloud will replace ALL current data. Continue?')
      : true;
    if (!proceed) return;

    const originalText = btn.textContent;
    btn.textContent = 'Restoring...';
    btn.disabled = true;

    const { data, error } = await window.supabase
      .from('backups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      showNotification('No cloud backups found', 'warning');
      return;
    }

    const latest = data[0];
    const snapshot = latest.data || latest.snapshot || null;
    if (!snapshot) {
      throw new Error('Invalid cloud backup format');
    }

    const result = await window.api.restoreFromSnapshot(snapshot);
    if (result && result.success) {
      showNotification('Cloud backup restored. Please restart the app.', 'success');
      setTimeout(() => { location.reload(); }, 2000);
    } else {
      throw new Error((result && result.message) || 'Restore failed');
    }
  } catch (error) {
    console.error('Cloud import error:', error);
    showNotification('Failed to restore cloud backup: ' + (error.message || 'unknown error'), 'danger');
  } finally {
    const btn = document.getElementById('import-cloud-backup-btn');
    if (btn) {
      btn.textContent = 'Restore from Cloud';
      btn.disabled = false;
    }
  }
}

async function handleImportBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const importBtn = document.getElementById('import-backup-btn');
    const originalText = importBtn.textContent;
    
    // Show loading state
    importBtn.textContent = 'Importing...';
    importBtn.disabled = true;
    
    const result = await window.api.importBackup(file.path);
    
    if (result.success) {
      showNotification('Backup imported successfully! Please restart the application.', 'success');
      
      // Refresh current page data
      setTimeout(() => {
        location.reload();
      }, 2000);
    } else {
      showNotification(result.error || 'Failed to import backup', 'error');
    }
  } catch (error) {
    console.error('Import backup error:', error);
    showNotification('Failed to import backup', 'error');
  } finally {
    // Reset button state and clear file input
    const importBtn = document.getElementById('import-backup-btn');
    importBtn.textContent = 'Import Backup';
    importBtn.disabled = false;
    event.target.value = '';
  }
}

// Supabase payload sanitization
function sanitizeEmployeeForSupabase(emp) {
  const toISO = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt.toISOString().split('T')[0];
  };
  const payload = {
    name: (emp.name || '').trim(),
    email: (emp.email || '').trim().toLowerCase(),
    phone: emp.phone || null,
    department: emp.department || null,
    designation: emp.designation || null,
    joinDate: toISO(emp.joinDate) || null,
    basicSalary: emp.basicSalary != null ? Number(emp.basicSalary) : null,
    signature: emp.signature || null
  };
  return payload;
}
 
// Offline Sync Processing
async function processPendingSync() {
  try {
    if (!navigator.onLine || !window.supabase) {
      return;
    }

    const queue = await window.api.getPendingSync();
    if (!Array.isArray(queue) || queue.length === 0) {
      return;
    }

    for (const op of queue) {
      try {
        let completed = false;

        if (op.type === 'employee') {
           const payload = op.payload || {};
           const email = (payload.email || '').trim().toLowerCase();
           const supPayload = sanitizeEmployeeForSupabase(payload);

          if (op.action === 'create') {
            // Use upsert by unique name so restore/import always uploads or updates
            const { data, error } = await window.supabase
              .from('employees')
              .upsert(supPayload, { onConflict: 'name' })
              .select();
            if (error) {
              console.error('Supabase upsert by name (create) error:', error);
            } else if (data && data.length > 0) {
              await window.api.updateEmployee({ id: payload.id, supabaseId: data[0].id });
              completed = true;
            }
          } else if (op.action === 'update') {
            let data = null;
            let error = null;

            if (payload.supabaseId) {
              const res = await window.supabase
                .from('employees')
                .update(supPayload)
                .eq('id', payload.supabaseId)
                .select();
              data = res.data;
              error = res.error;
              if (error) {
                console.error('Supabase update by ID error:', error);
              }
            } else {
              const name = (payload.name || '').trim();
              // Try update by unique name first
              let res = await window.supabase
                .from('employees')
                .update(supPayload)
                .eq('name', name)
                .select();
              data = res.data;
              error = res.error;
              if (error) {
                console.error('Supabase update by name error:', error);
              }

              if (!(data && data.length > 0) && !error && email) {
                // Try update by email as secondary key
                res = await window.supabase
                  .from('employees')
                  .update(supPayload)
                  .eq('email', email)
                  .select();
                data = res.data;
                error = res.error;
                if (error) {
                  console.error('Supabase update by email error:', error);
                }
              }

              if (!(data && data.length > 0) && !error) {
                // Fall back to upsert by unique name to ensure upload
                const up = await window.supabase
                  .from('employees')
                  .upsert(supPayload, { onConflict: 'name' })
                  .select();
                data = up.data;
                error = up.error;
                if (error) {
                  console.error('Supabase upsert by name (update fallback) error:', error);
                } else if (data && data.length > 0) {
                  await window.api.updateEmployee({ id: payload.id, supabaseId: data[0].id });
                }
              }
            }

            if (!error) {
              completed = true;
            }
          } else if (op.action === 'delete') {
            let error = null;
            if (payload.supabaseId) {
              const { error: delErr } = await window.supabase
                .from('employees')
                .delete()
                .eq('id', payload.supabaseId);
              error = delErr;
            } else {
              const { error: delErr } = await window.supabase
                .from('employees')
                .delete()
                .eq('email', email);
              error = delErr;
            }
            if (!error) {
              completed = true;
            }
          }
        }

        if (completed) {
          await window.api.markSyncComplete(op.id);
        }
      } catch (err) {
        console.error('Error processing sync operation:', op, err);
      }
    }

    const remaining = await window.api.getPendingSync();
    if (remaining.length === 0) {
      showNotification('All pending changes synced.', 'success');
    } else {
      showNotification(`Synced some changes. ${remaining.length} pending.`, 'info');
    }
  } catch (e) {
    console.error('processPendingSync error:', e);
  }
}

// Attendance History Functions
let currentEmployeeAttendance = [];
let filteredAttendance = [];

async function showAttendanceHistory(employeeId, employeeName, employees) {
  try {
    // Find employee details
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
      showNotification('Employee not found', 'error');
      return;
    }

    // Set employee info in modal
    document.getElementById('attendance-employee-name').textContent = employee.name;
    document.getElementById('attendance-employee-details').textContent = 
      `ID: ${employee.id} | Department: ${employee.department || 'N/A'} | Position: ${employee.designation || 'N/A'}`;

    // Fetch attendance data for this employee
    await loadEmployeeAttendance(employee.name);

    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    document.getElementById('attendance-date-from').value = formatDateForInput(thirtyDaysAgo.toISOString());
    document.getElementById('attendance-date-to').value = formatDateForInput(today.toISOString());
    document.getElementById('attendance-type-filter').value = 'all';

    // Apply initial filter and display
    filterEmployeeAttendance();

    // Show modal
    $('#attendance-history-modal').modal('show');

  } catch (error) {
    console.error('Error showing attendance history:', error);
    showNotification('Error loading attendance history', 'error');
  }
}

async function loadEmployeeAttendance(employeeName) {
  try {
    // Fetch all attendance records
    let attendanceData = [];
    if (window.fetchAttendanceData) {
      attendanceData = await window.fetchAttendanceData();
    } else if (window.supabase && window.supabase.from) {
      const { data } = await window.supabase.from('attendance').select('*').order('timestamp', { ascending: false });
      attendanceData = data || [];
    }

    // Filter records for this employee
    currentEmployeeAttendance = attendanceData.filter(record => 
      record.user_name === employeeName
    );

    console.log(`Loaded ${currentEmployeeAttendance.length} attendance records for ${employeeName}`);
  } catch (error) {
    console.error('Error loading employee attendance:', error);
    currentEmployeeAttendance = [];
  }
}

function filterEmployeeAttendance() {
  const fromDate = document.getElementById('attendance-date-from').value;
  const toDate = document.getElementById('attendance-date-to').value;
  const typeFilter = document.getElementById('attendance-type-filter').value;

  filteredAttendance = currentEmployeeAttendance.filter(record => {
    const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
    
    // Date filter
    if (fromDate && recordDate < fromDate) return false;
    if (toDate && recordDate > toDate) return false;
    
    // Type filter
    if (typeFilter !== 'all') {
      const clockInTypes = ['clock-in', 'in', 'time-in', 'clockin'];
      const clockOutTypes = ['clock-out', 'out', 'time-out', 'clockout'];
      
      if (typeFilter === 'in' && !clockInTypes.includes(record.type)) return false;
      if (typeFilter === 'out' && !clockOutTypes.includes(record.type)) return false;
    }
    
    return true;
  });

  displayEmployeeAttendance();
  updateAttendanceSummary();
}

function displayEmployeeAttendance() {
  const tableBody = document.getElementById('employee-attendance-list');
  const noDataMessage = document.getElementById('no-attendance-message');
  
  tableBody.innerHTML = '';
  
  if (filteredAttendance.length === 0) {
    noDataMessage.style.display = 'block';
    return;
  }
  
  noDataMessage.style.display = 'none';
  
  // Sort by timestamp (newest first)
  const sortedAttendance = [...filteredAttendance].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  sortedAttendance.forEach(record => {
    const row = document.createElement('tr');
    const recordDate = new Date(record.timestamp);
    
    // Format date and time
    const date = recordDate.toLocaleDateString();
    const time = recordDate.toLocaleTimeString();
    const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Determine type
    const clockInTypes = ['clock-in', 'in', 'time-in', 'clockin'];
    const isClockIn = clockInTypes.includes(record.type);
    const typeClass = isClockIn ? 'time-in' : 'time-out';
    const typeText = isClockIn ? 'Time In' : 'Time Out';
    
    row.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td><span class="time-badge ${typeClass}">${typeText}</span></td>
      <td>${dayName}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

function updateAttendanceSummary() {
  const totalRecords = filteredAttendance.length;
  
  const clockInTypes = ['clock-in', 'in', 'time-in', 'clockin'];
  const clockOutTypes = ['clock-out', 'out', 'time-out', 'clockout'];
  
  const timeInCount = filteredAttendance.filter(record => 
    clockInTypes.includes(record.type)
  ).length;
  
  const timeOutCount = filteredAttendance.filter(record => 
    clockOutTypes.includes(record.type)
  ).length;
  
  // Calculate days present as dates that have at least one IN and one OUT
  const datePresenceMap = {};
  filteredAttendance.forEach(record => {
    const dateKey = new Date(record.timestamp).toISOString().split('T')[0];
    if (!datePresenceMap[dateKey]) {
      datePresenceMap[dateKey] = { in: false, out: false };
    }
    if (clockInTypes.includes(record.type)) {
      datePresenceMap[dateKey].in = true;
    }
    if (clockOutTypes.includes(record.type)) {
      datePresenceMap[dateKey].out = true;
    }
  });
  const daysPresent = Object.values(datePresenceMap).filter(d => d.in && d.out).length;
  
  // Update summary display
  document.getElementById('total-records').textContent = totalRecords;
  document.getElementById('total-time-in').textContent = timeInCount;
  document.getElementById('total-time-out').textContent = timeOutCount;
  document.getElementById('total-days').textContent = daysPresent;
}

function exportAttendanceToCSV() {
  if (filteredAttendance.length === 0) {
    showNotification('No attendance data to export', 'warning');
    return;
  }
  
  const employeeName = document.getElementById('attendance-employee-name').textContent;
  
  // Create CSV content
  const headers = ['Date', 'Time', 'Type', 'Day'];
  let csvContent = headers.join(',') + '\n';
  
  const sortedAttendance = [...filteredAttendance].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  sortedAttendance.forEach(record => {
    const recordDate = new Date(record.timestamp);
    const date = recordDate.toLocaleDateString();
    const time = recordDate.toLocaleTimeString();
    const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    const clockInTypes = ['clock-in', 'in', 'time-in', 'clockin'];
    const typeText = clockInTypes.includes(record.type) ? 'Time In' : 'Time Out';
    
    csvContent += `"${date}","${time}","${typeText}","${dayName}"\n`;
  });
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${employeeName.replace(/\s+/g, '_')}_attendance_history.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  showNotification('Attendance history exported successfully', 'success');
}

// Event listeners for attendance history modal
document.addEventListener('DOMContentLoaded', function() {
  // Filter button
  document.getElementById('filter-attendance-btn')?.addEventListener('click', filterEmployeeAttendance);
  
  // Clear filter button
  document.getElementById('clear-attendance-filter-btn')?.addEventListener('click', function() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    document.getElementById('attendance-date-from').value = formatDateForInput(thirtyDaysAgo.toISOString());
    document.getElementById('attendance-date-to').value = formatDateForInput(today.toISOString());
    document.getElementById('attendance-type-filter').value = 'all';
    
    filterEmployeeAttendance();
  });
  
  // Export button
  document.getElementById('export-attendance-btn')?.addEventListener('click', exportAttendanceToCSV);
});