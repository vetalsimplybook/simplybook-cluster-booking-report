# SimplyBook Cluster Booking Report

A web-based tool for generating comprehensive booking reports across multiple companies in a SimplyBook cluster. This application connects to the SimplyBook Cluster API to retrieve booking data from selected companies and exports it as a detailed CSV report.

## Features

- **Cluster Authentication**: Secure connection to SimplyBook clusters using API keys
- **Multi-Company Selection**: Select multiple companies from your cluster for unified reporting
- **Advanced Filtering**: Filter bookings by booking date range, created date range, and status
- **Comprehensive Data Export**: Exports over 75 fields including booking details, client information, service data, and provider information
- **Pagination Support**: Automatically handles large datasets across multiple pages
- **Real-time Progress**: Live progress tracking during report generation
- **Responsive Design**: Works on desktop and mobile devices
- **Token Caching**: Remembers authentication for improved user experience


## Installation

1. Clone or download the project files to your web server
2. Ensure your web server can serve static HTML, CSS, and JavaScript files
3. No additional installation or dependencies required

## Usage

### Step 1: Authentication
1. Open `index.html` in your web browser
2. Enter your SimplyBook Cluster API Key
3. Enter your cluster name
4. Select your domain from the dropdown or enter a custom domain
5. Click "Authenticate & Connect"

### Step 2: Company Selection
1. Select companies from your cluster that you want to include in the report
2. Use "Select All" to quickly select all companies
3. Configure report parameters:
   - **Booking Date From / To**: Range applied to booking start time (optional)
   - **Created Date From / To**: Range applied to when booking was created (optional)
   - **Booking Status**: Filter by specific status or leave empty for all statuses
4. Click "Generate Report"

### Step 3: Report Generation
1. Monitor the progress as the system:
   - Obtains API tokens for each selected company
   - Retrieves booking data from all companies
   - Processes and compiles the data
2. Download the CSV report when generation is complete

## CSV Export Fields

The generated CSV report includes comprehensive booking information:

### Core Booking Data
- Company, Booking ID, Code, Status, Duration
- Start/End DateTime, Record Date
- Is Confirmed, Can Be Edited, Can Be Canceled

### Client Information
- Name, Email, Phone, Address details
- Country, State, Full Address
- Marketing preferences (email/SMS subscriptions)
- Account status (deleted status)

### Service Details
- Name, Description, Price, Currency
- Tax information, Deposit price
- Duration settings, Booking limits
- Membership requirements, Activity status

### Provider Information
- Name, Email, Phone, Description
- Capacity (QTY), Contact details
- Activity status, Associated services

### Payment & Invoice Data
- Invoice number, status, payment status
- Payment processor, Invoice datetime
- Membership ID

### Additional Metadata
- Location and Category information
- Ticket codes and validation data
- Testing status, User status
- Batch processing information
- Timezone and offset data

## API Requirements

- Valid SimplyBook Cluster API Key
- Access to SimplyBook Cluster API
- Appropriate permissions for the companies you want to report on

## API Endpoint Change

The application now uses the `/admin/detailed-report` endpoint on `user-api-v2.{domain}` with a two-step process:

### Step 1: Create Report (POST)
POST request creates a report generation task and returns a report ID:

```bash
curl -X POST \
  "https://user-api-v2.test.simplybook.ovh/admin/detailed-report" \
  -H "accept: application/json" \
  -H "X-Company-Login: YOUR_COMPANY_LOGIN" \
  -H "X-Token: YOUR_COMPANY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "order_direction": "asc",
        "order_field": "created_datetime",
        "filter": {
            "created_date_from": "2025-01-01",
            "created_date_to": "2025-01-31",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31"
        }
     }'

# Response: {"id": "8"}
```

### Step 2: Retrieve Report Results (GET)
GET request polls the report status and retrieves data when ready:

```bash
curl -X GET \
  "https://user-api-v2.test.simplybook.ovh/admin/detailed-report/:id" \
  -H "accept: application/json" \
  -H "X-Company-Login: YOUR_COMPANY_LOGIN" \
  -H "X-Token: YOUR_COMPANY_TOKEN"

# Response: [...]
```

The application automatically:
- Creates the report via POST
- Polls the GET endpoint every 5 seconds
- Retrieves the data when the report is ready
- Displays progress during generation

## Additional Filters

Supported filter keys used by this tool:
- `date_from`, `date_to` (booking start datetime range)
- `created_date_from`, `created_date_to` (booking creation datetime range)
- `status` (booking status)
- Potential extras (`event_id`, `unit_group_id`, `client_id`, `booking_type`, `code`) can be added if UI is expanded.

## Browser Compatibility

- Modern browsers with JavaScript enabled
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers supported

## Development

### File Structure
```
├── index.html          # Main application page
├── css/
│   ├── style.css       # Compiled CSS styles
│   ├── style.css.map   # CSS source map
│   └── style.less      # LESS source files
├── js/
│   └── script.js       # Main application logic
├── README.md           # This file
└── LICENSE             # License information
```

### Building CSS
If you modify the LESS files, recompile the CSS:
```bash
lessc css/style.less css/style.css --source-map
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is provided as-is for reporting purposes. Always verify critical data independently. The developers are not responsible for any business decisions made based on the reports generated by this tool.
