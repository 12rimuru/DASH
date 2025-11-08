# Electron Payroll Management System

A desktop application for payroll management built with Electron. This application provides similar features to the original PHP-based payroll system but as a standalone desktop application.

## Features

- **Dashboard**: Overview of employees, payheads, and salary statistics with visual charts
- **Employee Management**: Add, edit, and delete employee records
- **Payhead Management**: Configure earnings and deductions components
- **Salary Management**: Generate and manage employee salaries
- **Reports**: Generate various reports for employees, salaries, and departments
- **Settings**: Configure company information and application preferences

## Installation

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Setup

1. Clone the repository or download the source code

2. Install dependencies
   ```
   npm install
   ```

3. Start the application
   ```
   npm start
   ```

### Building the Application

To build the application for distribution:

```
npm run build
```

This will create executable files for your platform in the `dist` directory.

## Technology Stack

- **Electron**: Framework for building cross-platform desktop applications
- **Bootstrap**: Frontend framework for responsive design
- **Chart.js**: Library for data visualization
- **Electron Store**: Data persistence library

## Data Storage

The application uses Electron Store for data persistence, which saves data in JSON format locally on the user's machine. No external database is required.

## License

MIT