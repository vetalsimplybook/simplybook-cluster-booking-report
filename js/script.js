// SimplyBook Cluster API Integration
var ReportCreator = function() {
    this.config = {
        apiKey: null,
        cluster: null,
        domain: null
    };
    this.tokens = {
        clusterToken: null
    };
    this.companies = [];
    this.selectedCompanies = [];
    this.companyTokens = {};
    this.companyServices = {};
    this.selectedServiceNames = [];
    this.reportData = {
        companies: [],
        totalBookings: 0,
        errors: []
    };
    this.init();
}

jQuery.extend(ReportCreator.prototype, {

    init: function() {
        this.bindEvents();
        this.initializeForm();
        this.initializeDateFilters();
        this.checkCachedTokenAndAutoLogin();
    },

    bindEvents: function() {
        var self = this;

        // Demo login button
        $('#demo-login').on('click', function(e) {
            e.preventDefault();
            self.fillDemoCredentials();
        });

        // Domain selection handler
        $('#domain_select').on('change', function() {
            self.handleDomainSelection();
        });

        // Form submission
        $('#form-signin').on('submit', function(e) {
            e.preventDefault();
            self.handleAuthentication();
        });

        // Step 2 events
        $('#back-to-auth').on('click', function(e) {
            e.preventDefault();
            self.goBackToAuthentication();
        });

        $('#select-all-companies').on('change', function() {
            self.toggleAllCompanies($(this).is(':checked'));
        });

        $('#retry-companies').on('click', function(e) {
            e.preventDefault();
            self.loadCompanies();
        });

        $('#companies-form').on('submit', function(e) {
            e.preventDefault();
            self.proceedToReport();
        });

        // Company checkbox change handler (delegated)
        $(document).on('change', '.company-checkbox', function() {
            self.updateSelectedCompanies();
        });

        // Retry a single company's report (delegated, button is added at runtime)
        $(document).on('click', '.retry-company-btn', function(e) {
            e.preventDefault();
            self.retryCompany($(this).data('company'));
        });

        // Load services for the currently selected companies
        $('#load-services-btn').on('click', function(e) {
            e.preventDefault();
            self.loadServicesForSelectedCompanies();
        });

        // Service checkbox change handler (delegated, list is populated at runtime)
        $(document).on('change', '.service-checkbox', function() {
            self.updateSelectedServiceNames();
        });
    },

    initializeForm: function() {
        // Set initial domain value
        this.handleDomainSelection();

        // Show first step (will be overridden if we have cached token)
        $('.step-1').addClass('active');
    },

    checkCachedTokenAndAutoLogin: function() {
        var self = this;

        // Try to restore config from localStorage
        try {
            var tokenDataStr = localStorage.getItem('simplybook_cluster_token');
            if (!tokenDataStr) return;

            var tokenData = JSON.parse(tokenDataStr);

            // Check if token is expired
            if (Date.now() > tokenData.expiresAt) {
                console.log('Cached token expired, removing from storage');
                this.clearClusterTokenFromStorage();
                return;
            }

            // Restore config from cached token data
            this.config = {
                apiKey: tokenData.apiKey || '',
                cluster: tokenData.cluster || '',
                domain: tokenData.domain || ''
            };

            this.tokens.clusterToken = tokenData.token;

            // Fill form fields with cached data
            $('#api_key').val(this.config.apiKey);
            $('#cluster').val(this.config.cluster);
            if (this.config.domain) {
                $('#domain_select').val(this.config.domain).trigger('change');
            }

            console.log('Found valid cached token, attempting auto-login...');

            // Test if token still works by trying to load companies
            this.getAllCompanies()
                .then(function(companies) {
                    console.log('Cached token is valid, proceeding to step 2');
                    // Token works, go directly to step 2
                    self.proceedToNextStep();
                })
                .catch(function(error) {
                    console.log('Cached token is invalid:', error.message);
                    // Token doesn't work, clear it and stay on step 1
                    self.clearClusterTokenFromStorage();
                    self.tokens.clusterToken = null;
                });

        } catch (e) {
            console.warn('Failed to check cached token:', e);
            this.clearClusterTokenFromStorage();
        }
    },

    initializeDateFilters: function() {
        // Set default dates - last month
        var today = new Date();
        var lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 12);

        var formatDate = function(date) {
            return date.getFullYear() + '-' +
                   String(date.getMonth() + 1).padStart(2, '0') + '-' +
                   String(date.getDate()).padStart(2, '0');
        };

        // Don't set default values for booking dates (date_from, date_to)
        // $('#date_from').val(formatDate(lastMonth));
        // $('#date_to').val(formatDate(today));

        // Initialize created date filters if fields exist (optional UI inputs)
        if ($('#created_date_from').length) {
            $('#created_date_from').val(formatDate(lastMonth));
        }
        if ($('#created_date_to').length) {
            $('#created_date_to').val(formatDate(today));
        }
    },

    fillDemoCredentials: function() {
        $('#api_key').val('csk_0c002b67d178a76a43392e2c51e75e1f');
        $('#cluster').val('demoaccount');
        $('#domain_select').val('simplybook.pro').trigger('change');

        this.showMessage('Demo credentials filled successfully', 'success');
    },

    handleDomainSelection: function() {
        var selectedDomain = $('#domain_select').val();
        var customContainer = $('#domain_custom_container');

        if (selectedDomain === 'custom') {
            customContainer.show();
            $('#domain_custom').prop('required', true);
        } else {
            customContainer.hide();
            $('#domain_custom').prop('required', false);
            $('#domain_custom').val('');
        }

        // Update final domain value
        var finalDomain = selectedDomain === 'custom' ? $('#domain_custom').val() : selectedDomain;
        $('#domain_final').val(finalDomain);
    },

    handleAuthentication: function() {
        var self = this;

        // Get form values
        this.config = {
            apiKey: $('#api_key').val().trim(),
            cluster: $('#cluster').val().trim(),
            domain: $('#domain_select').val() === 'custom' ? $('#domain_custom').val().trim() : $('#domain_select').val()
        };

        // Validate required fields
        if (!this.validateForm()) {
            return;
        }

        // Start authentication process
        this.setLoading(true);
        this.authenticate()
            .then(function() {
                self.showMessage('Authentication successful!', 'success');
                self.proceedToNextStep();
            })
            .catch(function(error) {
                self.showMessage('Authentication failed: ' + error.message, 'error');
            })
            .finally(function() {
                self.setLoading(false);
            });
    },

    validateForm: function() {
        var errors = [];

        if (!this.config.apiKey) errors.push('API Key is required');
        if (!this.config.cluster) errors.push('Cluster is required');
        if (!this.config.domain) errors.push('Domain is required');

        if (errors.length > 0) {
            this.showMessage(errors.join('<br>'), 'error');
            return false;
        }

        return true;
    },

    authenticate: function() {
        var self = this;

        return this.getClusterToken()
            .then(function(clusterToken) {
                self.tokens.clusterToken = clusterToken;
                self.saveClusterTokenToStorage(clusterToken);
                return self.verifyClusterAccess(clusterToken);
            });
    },

    getClusterToken: function() {
        var self = this;

        // Try to get token from localStorage first
        var cachedToken = this.getClusterTokenFromStorage();
        if (cachedToken) {
            console.log('Using cached cluster token');
            return Promise.resolve(cachedToken);
        }

        return new Promise(function(resolve, reject) {
            $.ajax({
                url: self.getClusterApiUrl() + 'auth',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cluster': self.config.cluster
                },
                data: JSON.stringify({
                    key: self.config.apiKey
                }),
                success: function(response) {
                    if (response && response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('Invalid response from cluster API'));
                    }
                },
                error: function(xhr, status, error) {
                    var errorMessage = 'Failed to get cluster token';
                    try {
                        var response = JSON.parse(xhr.responseText);
                        errorMessage = response.error || response.message || errorMessage;
                    } catch (e) {
                        errorMessage = error || errorMessage;
                    }
                    reject(new Error(errorMessage));
                }
            });
        });
    },

    saveClusterTokenToStorage: function(token) {
        if (!token) return;

        var tokenData = {
            token: token,
            apiKey: this.config.apiKey,
            cluster: this.config.cluster,
            domain: this.config.domain,
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes from now
        };

        try {
            localStorage.setItem('simplybook_cluster_token', JSON.stringify(tokenData));
            console.log('Cluster token saved to localStorage, expires in 30 minutes');
        } catch (e) {
            console.warn('Failed to save token to localStorage:', e);
        }
    },

    getClusterTokenFromStorage: function() {
        try {
            var tokenDataStr = localStorage.getItem('simplybook_cluster_token');
            if (!tokenDataStr) return null;

            var tokenData = JSON.parse(tokenDataStr);

            // Check if token is expired
            if (Date.now() > tokenData.expiresAt) {
                console.log('Cached token expired, removing from storage');
                this.clearClusterTokenFromStorage();
                return null;
            }

            // Check if token matches current cluster and domain
            if (tokenData.cluster !== this.config.cluster || tokenData.domain !== this.config.domain) {
                console.log('Cached token for different cluster/domain, removing from storage');
                this.clearClusterTokenFromStorage();
                return null;
            }

            return tokenData.token;
        } catch (e) {
            console.warn('Failed to get token from localStorage:', e);
            this.clearClusterTokenFromStorage();
            return null;
        }
    },

    clearClusterTokenFromStorage: function() {
        try {
            localStorage.removeItem('simplybook_cluster_token');
            console.log('Cluster token removed from localStorage');
        } catch (e) {
            console.warn('Failed to remove token from localStorage:', e);
        }
    },

    handleApiError: function(xhr, operation) {
        console.error('API Error in', operation + ':', xhr.status, xhr.statusText);

        // If it's an authentication error, clear the cached token
        if (xhr.status === 401 || xhr.status === 403) {
            console.log('Authentication error detected, clearing cached token');
            this.clearClusterTokenFromStorage();
            this.tokens.clusterToken = null;
        }
    },

    verifyClusterAccess: function(clusterToken) {
        var self = this;

        return new Promise(function(resolve, reject) {
            // Simple verification - just check if token works
            resolve(true);
        });
    },

    getClusterApiUrl: function() {
        return 'https://cluster-api.' + this.config.domain + '/';
    },

    proceedToNextStep: function() {
        // Hide current step and show next
        $('.step-1').removeClass('active');
        $('.step-2').addClass('active');

        // Update connection info
        $('#connected-cluster').text(this.config.cluster);
        $('#connected-domain').text(this.config.domain);

        // Load companies
        this.loadCompanies();
    },

    loadCompanies: function() {
        var self = this;

        // Show loading state
        $('#companies-loading').show();
        $('#companies-container').hide();
        $('#companies-error').hide();

        // Load companies with proper pagination
        this.getAllCompanies()
            .then(function(companies) {
                self.companies = companies;
                self.displayCompanies(companies);
            })
            .catch(function(error) {
                self.showCompaniesError(error.message);
            });
    },

    getAllCompanies: function() {
        var self = this;
        var allCompanies = [];
        var page = 1;

        function loadPage() {
            return new Promise(function(resolve, reject) {
                $.ajax({
                    url: self.getClusterApiUrl() + 'companies',
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Cluster': self.config.cluster,
                        'X-Token': self.tokens.clusterToken
                    },
                    data: {
                        page: page,
                        on_page: 50
                    },
                    success: function(response) {
                        if (response && response.data) {
                            allCompanies = allCompanies.concat(response.data);

                            // Check if there are more pages using metadata
                            if (response.metadata && page < response.metadata.pages_count) {
                                page++;
                                loadPage().then(resolve).catch(reject);
                            } else {
                                resolve(allCompanies);
                            }
                        } else {
                            reject(new Error('Invalid companies response'));
                        }
                    },
                    error: function(xhr, status, error) {
                        // Handle API error and clear token if necessary
                        self.handleApiError(xhr, 'getAllCompanies');

                        var errorMessage = 'Failed to load companies';
                        try {
                            var response = JSON.parse(xhr.responseText);
                            errorMessage = response.error || response.message || errorMessage;
                        } catch (e) {
                            errorMessage = error || errorMessage;
                        }
                        reject(new Error(errorMessage));
                    }
                });
            });
        }

        return loadPage();
    },

    displayCompanies: function(companies) {
        var self = this;
        var companiesList = $('#companies-list');

        companiesList.empty();

        if (!companies || companies.length === 0) {
            companiesList.html('<p class="text-muted text-center py-3">No companies found in this cluster.</p>');
        } else {
            companies.forEach(function(company) {
                var companyHtml = self.createCompanyItem(company);
                companiesList.append(companyHtml);
            });
        }

        // Hide loading and show companies container
        $('#companies-loading').hide();
        $('#companies-container').show();

        // Reset selections
        this.selectedCompanies = [];
        this.updateSelectedCompanies();
    },

    createCompanyItem: function(company) {
        var status = company.status || 'unknown';
        var statusClass = status === 'active' ? 'text-success' : 'text-muted';

        return $(`
            <div class="form-check">
                <input class="form-check-input company-checkbox" type="checkbox" 
                       value="${company.login}" id="company-${company.login}">
                <label class="form-check-label company-item" for="company-${company.login}">
                    <div class="company-info">
                        <div class="company-name">${company.title || company.login}</div>
                        <div class="company-details">
                            Login: <strong>${company.login}</strong> | 
                            Status: <span class="${statusClass}">${status}</span>
                        </div>
                    </div>
                    <div class="company-stats">
                        <span class="stat-item">ID: ${company.id}</span>
                    </div>
                </label>
            </div>
        `);
    },

    toggleAllCompanies: function(selectAll) {
        $('.company-checkbox').prop('checked', selectAll);
        this.updateSelectedCompanies();
    },

    updateSelectedCompanies: function() {
        var self = this;
        this.selectedCompanies = [];

        $('.company-checkbox:checked').each(function() {
            self.selectedCompanies.push($(this).val());
        });

        // Update counter
        $('#selected-count').text(this.selectedCompanies.length);

        // Update button state
        $('#proceed-to-report').prop('disabled', this.selectedCompanies.length === 0);

        // Update select all checkbox
        var totalCheckboxes = $('.company-checkbox').length;
        var checkedCheckboxes = $('.company-checkbox:checked').length;

        $('#select-all-companies').prop('indeterminate',
            checkedCheckboxes > 0 && checkedCheckboxes < totalCheckboxes);
        $('#select-all-companies').prop('checked',
            checkedCheckboxes === totalCheckboxes && totalCheckboxes > 0);

        // Company selection changed - any previously loaded services no longer match, reset them
        $('#load-services-btn').prop('disabled', this.selectedCompanies.length === 0);
        $('#services-list').hide().empty();
        $('#services-error').hide();
        this.companyServices = {};
        this.selectedServiceNames = [];
    },

    showCompaniesError: function(message) {
        $('#companies-loading').hide();
        $('#companies-container').hide();
        $('#companies-error-message').text(message);
        $('#companies-error').show();
    },

    goBackToAuthentication: function() {
        $('.step-2').removeClass('active');
        $('.step-1').addClass('active');
    },

    loadServicesForSelectedCompanies: function() {
        var self = this;
        var companies = this.selectedCompanies.slice();

        $('#services-error').hide();
        $('#services-list').hide().empty();
        $('#services-loading').show();

        var tokenPromises = companies.map(function(companyLogin) {
            if (self.companyTokens[companyLogin]) {
                return Promise.resolve();
            }
            return self.getCompanyToken(companyLogin)
                .then(function(token) {
                    self.companyTokens[companyLogin] = token;
                })
                .catch(function() {
                    // This company's services just won't be listed; report generation
                    // will surface its token error the same way it does today.
                });
        });

        Promise.all(tokenPromises)
            .then(function() {
                var servicePromises = companies
                    .filter(function(companyLogin) {
                        return !!self.companyTokens[companyLogin];
                    })
                    .map(function(companyLogin) {
                        return self.getCompanyServices(companyLogin)
                            .then(function(services) {
                                self.companyServices[companyLogin] = services;
                            })
                            .catch(function() {
                                self.companyServices[companyLogin] = [];
                            });
                    });

                return Promise.all(servicePromises);
            })
            .then(function() {
                $('#services-loading').hide();
                self.displayServices();
            })
            .catch(function(error) {
                $('#services-loading').hide();
                $('#services-error').text('Failed to load services: ' + error.message).show();
            });
    },

    getCompanyServices: function(companyLogin) {
        var self = this;

        return new Promise(function(resolve, reject) {
            $.ajax({
                url: self.getUserApiUrl() + '/admin/services',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Token': self.companyTokens[companyLogin],
                    'X-Company-Login': companyLogin
                },
                success: function(response) {
                    var services = Array.isArray(response) ? response : (response && response.data) || [];
                    resolve(services);
                },
                error: function(xhr, status, error) {
                    self.handleApiError(xhr, 'getCompanyServices');
                    reject(new Error(error || 'Failed to load services'));
                }
            });
        });
    },

    displayServices: function() {
        var self = this;
        var nameToCount = {};

        Object.keys(this.companyServices).forEach(function(companyLogin) {
            (self.companyServices[companyLogin] || []).forEach(function(service) {
                nameToCount[service.name] = (nameToCount[service.name] || 0) + 1;
            });
        });

        var names = Object.keys(nameToCount).sort();
        var list = $('#services-list');
        list.empty();

        if (names.length === 0) {
            list.html('<p class="text-muted small mb-0 p-2">No services found for the selected companies.</p>');
        } else {
            var totalCompanies = this.selectedCompanies.length;
            names.forEach(function(name, index) {
                list.append(`
                    <div class="form-check">
                        <input class="form-check-input service-checkbox" type="checkbox" value="${name}" id="service-${index}">
                        <label class="form-check-label" for="service-${index}">
                            ${name} <span class="text-muted small">(${nameToCount[name]}/${totalCompanies} companies)</span>
                        </label>
                    </div>
                `);
            });
        }

        list.show();
        this.updateSelectedServiceNames();
    },

    updateSelectedServiceNames: function() {
        var self = this;
        this.selectedServiceNames = [];

        $('.service-checkbox:checked').each(function() {
            self.selectedServiceNames.push($(this).val());
        });
    },

    proceedToReport: function() {
        if (this.selectedCompanies.length === 0) {
            this.showMessage('Please select at least one company', 'error');
            return;
        }

        var reportTimeoutMinutes = parseInt($('#report_timeout').val(), 10);
        if (!reportTimeoutMinutes || reportTimeoutMinutes < 1) {
            reportTimeoutMinutes = 2;
        }

        var reportParams = {
            companies: this.selectedCompanies,
            dateFrom: $('#date_from').val(),
            dateTo: $('#date_to').val(),
            bookingStatus: $('#booking_status').val(),
            // New optional created date filters (fallback to booking dates if not provided)
            createdDateFrom: $('#created_date_from').length ? $('#created_date_from').val() : $('#date_from').val(),
            createdDateTo: $('#created_date_to').length ? $('#created_date_to').val() : $('#date_to').val(),
            reportTimeoutMinutes: reportTimeoutMinutes,
            selectedServiceNames: this.selectedServiceNames.slice(),
            chunkPeriod: $('#chunk_period').val() || 'none'
        };

        if (reportParams.dateFrom && reportParams.dateTo) {
            if (new Date(reportParams.dateFrom) > new Date(reportParams.dateTo)) {
                this.showMessage('Date "From" cannot be later than date "To"', 'error');
                return;
            }
        }
        // Created date range validation
        if (reportParams.createdDateFrom && reportParams.createdDateTo) {
            if (new Date(reportParams.createdDateFrom) > new Date(reportParams.createdDateTo)) {
                this.showMessage('Created Date "From" cannot be later than Created Date "To"', 'error');
                return;
            }
        }

        $('.step-2').removeClass('active');
        $('.step-3').addClass('active');

        this.initializeReportGeneration(reportParams);
    },

    initializeReportGeneration: function(reportParams) {
        var self = this;
        var statusText = reportParams.bookingStatus ?
            reportParams.bookingStatus.charAt(0).toUpperCase() + reportParams.bookingStatus.slice(1) :
            'All Statuses';

        var dateRangeText = '';
        if (reportParams.dateFrom && reportParams.dateTo) {
            dateRangeText = `From ${reportParams.dateFrom} to ${reportParams.dateTo}`;
        } else if (reportParams.dateFrom) {
            dateRangeText = `From ${reportParams.dateFrom}`;
        } else if (reportParams.dateTo) {
            dateRangeText = `Until ${reportParams.dateTo}`;
        } else {
            dateRangeText = 'All dates';
        }

        var servicesText = reportParams.selectedServiceNames.length ?
            reportParams.selectedServiceNames.join(', ') : 'All services';

        var chunkLabels = { none: 'None', week: 'Weekly', month: 'Monthly' };
        var chunkText = chunkLabels[reportParams.chunkPeriod] || 'None';

        $('.step-3').html(`
            <div class="form-signin-wide w-100 m-auto">
                <svg class="header--logo-image mb-4" xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 0 122.55 18.92">
                    <defs> <style>.cls-1l, .cls-2l { fill: #2eabe2; } .cls-1l, .cls-3l { fill-rule: evenodd; } .cls-3l { fill: #26334b; }</style> </defs>
                    <title>SimplyBook.me</title>
                    <!-- SVG content shortened for brevity -->
                </svg>
                
                <h2 class="text-center mb-4">Generating Booking Report</h2>
                
                <div class="alert alert-info mb-4" role="alert">
                    <h5 class="mb-3">Report Parameters</h5>
                    <div class="row text-start">
                        <div class="col-md-6">
                            <p><strong>Selected Companies:</strong> ${reportParams.companies.length}</p>
                            <p><strong>Date Range:</strong> ${dateRangeText}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Booking Status:</strong> ${statusText}</p>
                            <p><strong>Cluster:</strong> ${this.config.cluster}</p>
                            <p><strong>Services:</strong> ${servicesText}</p>
                            <p><strong>Splitting:</strong> ${chunkText}</p>
                        </div>
                    </div>
                </div>

                <!-- Progress Section -->
                <div class="progress-section mb-4">
                    <h5>Progress</h5>
                    <div class="progress mb-2">
                        <div class="progress-bar" role="progressbar" style="width: 0%" id="report-progress"></div>
                    </div>
                    <div id="progress-status" class="text-muted">Initializing...</div>
                </div>

                <!-- Company Status -->
                <div class="company-status mb-4">
                    <h5>Company Status</h5>
                    <div id="company-status-list" class="row">
                        <!-- Company status items will be added here -->
                    </div>
                </div>

                <!-- Results Summary -->
                <div id="results-summary" class="alert alert-success" style="display: none;">
                    <h5>Report Complete!</h5>
                    <div id="summary-content"></div>
                </div>

                <!-- Error Summary -->
                <div id="error-summary" class="alert alert-danger" style="display: none;">
                    <h5>Errors Encountered</h5>
                    <div id="error-content"></div>
                </div>
                
                <div class="text-center mt-4">
                    <button class="btn btn-secondary me-2" onclick="location.reload()">Start Over</button>
                    <button class="btn btn-success" id="download-report" style="display: none;">
                        <i class="fas fa-download me-2"></i>Download CSV Report
                    </button>
                </div>
            </div>
        `);

        // Start the report generation process
        this.startReportGeneration(reportParams);
    },

    startReportGeneration: function(reportParams) {
        var self = this;

        // Reset report data
        this.reportData = {
            companies: [],
            totalBookings: 0,
            errors: [],
            reportParams: reportParams
        };

        // Update progress
        this.updateProgress(0, 'Getting company tokens...');

        // Get tokens for all selected companies
        this.getCompanyTokens(reportParams.companies)
            .then(function() {
                return self.collectBookingsFromAllCompanies(reportParams);
            })
            .then(function() {
                self.showReportResults();
            })
            .catch(function(error) {
                self.showReportError(error.message);
            });
    },

    getCompanyTokens: function(companyLogins) {
        var self = this;
        var promises = [];

        companyLogins.forEach(function(companyLogin) {
            var promise = self.getCompanyToken(companyLogin)
                .then(function(token) {
                    self.companyTokens[companyLogin] = token;
                    self.updateCompanyStatus(companyLogin, 'token-success', 'Token obtained');
                })
                .catch(function(error) {
                    self.updateCompanyStatus(companyLogin, 'token-error', 'Token failed: ' + error.message);
                    self.reportData.errors.push({
                        company: companyLogin,
                        stage: 'token',
                        error: error.message
                    });
                });

            promises.push(promise);
        });

        return Promise.allSettled(promises);
    },

    getCompanyToken: function(companyLogin) {
        var self = this;

        return new Promise(function(resolve, reject) {
            $.ajax({
                url: self.getClusterApiUrl() + 'companies/' + companyLogin + '/api-token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cluster': self.config.cluster,
                    'X-Token': self.tokens.clusterToken
                },
                data: JSON.stringify({}),
                success: function(response) {
                    if (response && response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('Invalid token response'));
                    }
                },
                error: function(xhr, status, error) {
                    self.handleApiError(xhr, 'getCompanyToken');

                    var errorMessage = 'Failed to get company token';
                    try {
                        var response = JSON.parse(xhr.responseText);
                        errorMessage = response.error || response.message || errorMessage;
                    } catch (e) {
                        errorMessage = error || errorMessage;
                    }
                    reject(new Error(errorMessage));
                }
            });
        });
    },

    collectBookingsFromAllCompanies: function(reportParams) {
        var self = this;
        var promises = [];
        var completedCompanies = 0;
        var totalCompanies = reportParams.companies.length;

        reportParams.companies.forEach(function(companyLogin) {
            if (!self.companyTokens[companyLogin]) {
                // Skip companies that failed to get tokens
                return;
            }

            // Update status to show report is being generated
            self.updateCompanyStatus(companyLogin, 'bookings-generating', 'Generating report...');

            var promise = self.collectCompanyReport(companyLogin, reportParams)
                .then(function(result) {
                    completedCompanies++;
                    var progress = Math.round((completedCompanies / totalCompanies) * 100);
                    self.updateProgress(progress, `Collected bookings from ${completedCompanies}/${totalCompanies} companies`);

                    self.applyCompanyReportResult(companyLogin, result);
                });

            promises.push(promise);
        });

        return Promise.allSettled(promises);
    },

    // Resolve which service ids to query for a company based on the selected service
    // names. Returns [{eventId: null, serviceName: null}] when no service filter is set
    // (meaning "no event_id filter, query everything"), or [] when the company has none
    // of the selected services (meaning "skip this company, nothing to fetch").
    resolveServiceJobsForCompany: function(companyLogin, reportParams) {
        if (!reportParams.selectedServiceNames || reportParams.selectedServiceNames.length === 0) {
            return [{ eventId: null, serviceName: null }];
        }

        var services = this.companyServices[companyLogin] || [];
        var matched = services.filter(function(service) {
            return reportParams.selectedServiceNames.indexOf(service.name) !== -1;
        });

        return matched.map(function(service) {
            return { eventId: service.id, serviceName: service.name };
        });
    },

    // Splits a booking date range into contiguous chunks of `period` size ('week' = 7
    // days, 'month' = 30 days, rolling windows rather than calendar-aligned). Returns
    // the whole range as a single chunk when chunking isn't applicable (no period, or
    // one of the dates is missing).
    generateDateChunks: function(dateFromStr, dateToStr, period) {
        if ((period !== 'week' && period !== 'month') || !dateFromStr || !dateToStr) {
            return [{ from: dateFromStr || '', to: dateToStr || '' }];
        }

        var chunkDays = period === 'week' ? 7 : 30;
        var chunks = [];
        var current = new Date(dateFromStr + 'T00:00:00');
        var end = new Date(dateToStr + 'T00:00:00');

        var formatDate = function(date) {
            return date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0');
        };

        while (current <= end) {
            var chunkEnd = new Date(current);
            chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1);
            if (chunkEnd > end) {
                chunkEnd = new Date(end);
            }

            chunks.push({ from: formatDate(current), to: formatDate(chunkEnd) });

            current = new Date(chunkEnd);
            current.setDate(current.getDate() + 1);
        }

        return chunks;
    },

    describeJob: function(job) {
        var parts = [job.serviceName || 'All services'];
        if (job.dateFrom || job.dateTo) {
            parts.push(`${job.dateFrom || '…'} → ${job.dateTo || '…'}`);
        }
        return parts.join(', ');
    },

    // Fetches one company's report across every (service x date-chunk) combination,
    // sequentially, so a large report becomes several small ones instead of one big
    // request that's more likely to time out. Never rejects - job failures are
    // collected in jobErrors so the rest of the jobs still run and partial data isn't lost.
    collectCompanyReport: function(companyLogin, reportParams) {
        var self = this;
        var serviceJobs = this.resolveServiceJobsForCompany(companyLogin, reportParams);

        if (serviceJobs.length === 0) {
            return Promise.resolve({ skipped: true, bookings: [], totalCount: 0, jobErrors: [], totalJobs: 0 });
        }

        var dateChunks = this.generateDateChunks(reportParams.dateFrom, reportParams.dateTo, reportParams.chunkPeriod);

        var jobs = [];
        serviceJobs.forEach(function(serviceJob) {
            dateChunks.forEach(function(dateChunk) {
                jobs.push({
                    eventId: serviceJob.eventId,
                    serviceName: serviceJob.serviceName,
                    dateFrom: dateChunk.from,
                    dateTo: dateChunk.to
                });
            });
        });

        var allBookings = [];
        var jobErrors = [];
        var jobIndex = 0;
        var chain = Promise.resolve();

        jobs.forEach(function(job) {
            chain = chain.then(function() {
                jobIndex++;
                var label = self.describeJob(job);
                self.updateCompanyStatus(companyLogin, 'bookings-generating',
                    `Fetching ${jobIndex}/${jobs.length}: ${label}`);

                return self.getCompanyBookings(companyLogin, reportParams, job)
                    .then(function(bookingsData) {
                        allBookings = allBookings.concat(bookingsData.bookings);
                    })
                    .catch(function(error) {
                        jobErrors.push({ label: label, error: error.message });
                    });
            });
        });

        return chain.then(function() {
            return {
                skipped: false,
                bookings: allBookings,
                totalCount: allBookings.length,
                jobErrors: jobErrors,
                totalJobs: jobs.length
            };
        });
    },

    // Applies a collectCompanyReport() result to reportData and the company's status card.
    applyCompanyReportResult: function(companyLogin, result) {
        var self = this;

        if (result.skipped) {
            this.updateCompanyStatus(companyLogin, 'bookings-success', 'No matching services for this company');
            this.reportData.companies.push({ login: companyLogin, bookings: [], totalCount: 0 });
            return;
        }

        this.reportData.companies.push({
            login: companyLogin,
            bookings: result.bookings,
            totalCount: result.totalCount
        });
        this.reportData.totalBookings += result.bookings.length;

        var successCount = result.totalJobs - result.jobErrors.length;

        if (result.jobErrors.length === 0) {
            this.updateCompanyStatus(companyLogin, 'bookings-success', `Found ${result.bookings.length} bookings`);
        } else if (successCount === 0) {
            this.updateCompanyStatus(companyLogin, 'bookings-error',
                `All ${result.totalJobs} requests failed: ${result.jobErrors[0].error}`);
        } else {
            this.updateCompanyStatus(companyLogin, 'bookings-partial',
                `${successCount}/${result.totalJobs} succeeded, ${result.jobErrors.length} failed`);
        }

        result.jobErrors.forEach(function(jobError) {
            self.reportData.errors.push({
                company: companyLogin,
                stage: 'bookings',
                error: `[${jobError.label}] ${jobError.error}`
            });
        });
    },

    getCompanyBookings: function(companyLogin, reportParams, jobOverrides) {
        var self = this;
        jobOverrides = jobOverrides || {};

        return new Promise(function(resolve, reject) {
            var filter = {};
            if (reportParams.bookingStatus) {
                filter.status = reportParams.bookingStatus;
            }

            var dateFrom = jobOverrides.dateFrom !== undefined ? jobOverrides.dateFrom : reportParams.dateFrom;
            var dateTo = jobOverrides.dateTo !== undefined ? jobOverrides.dateTo : reportParams.dateTo;
            if (dateFrom) {
                filter.date_from = dateFrom;
            }
            if (dateTo) {
                filter.date_to = dateTo;
            }
            // Added created date filters
            if (reportParams.createdDateFrom) {
                filter.created_date_from = reportParams.createdDateFrom;
            }
            if (reportParams.createdDateTo) {
                filter.created_date_to = reportParams.createdDateTo;
            }
            if (jobOverrides.eventId) {
                filter.event_id = jobOverrides.eventId;
            }

            var requestData = {
                filter: filter,
                order_field: 'created_datetime',
                order_direction: 'asc'
            };

            // Step 1: Create report (POST request)
            $.ajax({
                url: self.getUserApiUrl() + '/admin/detailed-report',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Token': self.companyTokens[companyLogin],
                    'X-Company-Login': companyLogin
                },
                data: JSON.stringify(requestData),
                processData: false,
                success: function(response) {
                    if (response && response.id) {
                        var reportId = response.id;
                        console.log('Report created for ' + companyLogin + ' with ID: ' + reportId);

                        // Step 2: Poll for report completion
                        var pollIntervalMs = 5000;
                        var maxAttempts = Math.max(1, Math.round((reportParams.reportTimeoutMinutes * 60 * 1000) / pollIntervalMs));
                        self.pollReportStatus(companyLogin, reportId, resolve, reject, maxAttempts, pollIntervalMs);
                    } else {
                        reject(new Error('Invalid report creation response'));
                    }
                },
                error: function(xhr, status, error) {
                    self.handleApiError(xhr, 'getCompanyBookings');

                    var errorMessage = 'Failed to create report';
                    try {
                        var response = JSON.parse(xhr.responseText);
                        errorMessage = response.error || response.message || errorMessage;
                    } catch (e) {
                        errorMessage = error || errorMessage;
                    }
                    reject(new Error(errorMessage));
                }
            });
        });
    },

    pollReportStatus: function(companyLogin, reportId, resolve, reject, maxAttempts, pollInterval) {
        var self = this;
        maxAttempts = maxAttempts || 60; // Default: 5 minutes with 5 second intervals
        pollInterval = pollInterval || 5000; // 5 seconds
        var attemptCount = 0;

        function checkStatus() {
            attemptCount++;

            $.ajax({
                url: self.getUserApiUrl() + '/admin/detailed-report/' + reportId,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Token': self.companyTokens[companyLogin],
                    'X-Company-Login': companyLogin,
                },
                success: function(response) {
                    // Check if response is ready
                    var isReady = false;
                    var allBookings = [];
                    var totalCount = 0;

                    if (Array.isArray(response)) {
                        // Response is array directly - report is ready
                        isReady = true;
                        allBookings = response;
                        totalCount = response.length;
                    } else if (response && response.data && Array.isArray(response.data)) {
                        // Response wrapped in {data: [...]} - report is ready
                        isReady = true;
                        allBookings = response.data;
                        totalCount = response.metadata ? response.metadata.items_count : response.data.length;
                    } else if (response && response.code === 404) {
                        // Still processing (returns {code: 404, message: "...processing"})
                        isReady = false;
                    }

                    if (isReady) {
                        console.log('Report ' + reportId + ' completed for ' + companyLogin + ' with ' + allBookings.length + ' bookings');
                        resolve({
                            bookings: allBookings,
                            totalCount: totalCount
                        });
                    } else if (attemptCount >= maxAttempts) {
                        // Timeout
                        reject(new Error('Report generation timeout after ' + Math.round(maxAttempts * pollInterval / 60000) + ' min. Increase Report Timeout above and retry this company.'));
                    } else {
                        // Report not ready yet, poll again
                        console.log('Report ' + reportId + ' processing, attempt ' + attemptCount + '/' + maxAttempts);
                        setTimeout(checkStatus, pollInterval);
                    }
                },
                error: function(xhr, status, error) {
                    // If 404 or processing status, continue polling
                    if (xhr.status === 404 && attemptCount < maxAttempts) {
                        console.log('Report ' + reportId + ' processing, attempt ' + attemptCount + '/' + maxAttempts);
                        setTimeout(checkStatus, pollInterval);
                    } else if (attemptCount >= maxAttempts) {
                        reject(new Error('Report generation timeout after ' + Math.round(maxAttempts * pollInterval / 60000) + ' min. Increase Report Timeout above and retry this company.'));
                    } else {
                        self.handleApiError(xhr, 'pollReportStatus');

                        var errorMessage = 'Failed to get report';
                        try {
                            var response = JSON.parse(xhr.responseText);
                            errorMessage = response.error || response.message || errorMessage;
                        } catch (e) {
                            errorMessage = error || errorMessage;
                        }
                        reject(new Error(errorMessage));
                    }
                }
            });
        }

        // Start polling
        checkStatus();
    },

    getUserApiUrl: function() {
        return 'https://user-api-v2.' + this.config.domain;
    },

    updateProgress: function(percentage, message) {
        $('#report-progress').css('width', percentage + '%').attr('aria-valuenow', percentage);
        $('#progress-status').text(message);
    },

    updateCompanyStatus: function(companyLogin, status, message) {
        var statusClass = '';
        var cardClass = '';
        var icon = '';

        switch (status) {
            case 'token-success':
                statusClass = 'text-success';
                cardClass = 'is-success';
                icon = 'fas fa-check';
                break;
            case 'token-error':
                statusClass = 'text-danger';
                cardClass = 'is-error';
                icon = 'fas fa-times';
                break;
            case 'bookings-generating':
                statusClass = 'text-info';
                cardClass = 'is-pending';
                icon = 'fas fa-spinner fa-spin';
                break;
            case 'bookings-success':
                statusClass = 'text-success';
                cardClass = 'is-success';
                icon = 'fas fa-check-double';
                break;
            case 'bookings-error':
                statusClass = 'text-danger';
                cardClass = 'is-error';
                icon = 'fas fa-exclamation-triangle';
                break;
            case 'bookings-partial':
                statusClass = 'text-warning';
                cardClass = 'is-partial';
                icon = 'fas fa-exclamation-circle';
                break;
            default:
                statusClass = 'text-muted';
                cardClass = '';
                icon = 'fas fa-clock';
        }

        var showRetry = (status === 'token-error' || status === 'bookings-error' || status === 'bookings-partial');
        var retryButtonHtml = showRetry ?
            `<button type="button" class="btn btn-sm btn-outline-danger retry-company-btn" data-company="${companyLogin}">
                <i class="fas fa-redo me-1"></i>Retry
            </button>` : '';

        var existingItem = $(`#status-${companyLogin}`);
        if (existingItem.length === 0) {
            $('#company-status-list').append(`
                <div class="col-md-4 mb-2" id="status-${companyLogin}">
                    <div class="company-status-card ${cardClass}">
                        <div class="d-flex align-items-start">
                            <i class="${icon} me-2 mt-1 ${statusClass}"></i>
                            <div class="flex-grow-1">
                                <strong>${companyLogin}</strong><br>
                                <small class="status-message ${statusClass}">${message}</small>
                            </div>
                        </div>
                        <div class="retry-container">${retryButtonHtml}</div>
                    </div>
                </div>
            `);
        } else {
            var card = existingItem.find('.company-status-card').attr('class', `company-status-card ${cardClass}`);
            card.find('i').first().attr('class', `${icon} me-2 mt-1 ${statusClass}`);
            card.find('.status-message').attr('class', `status-message ${statusClass}`).text(message);
            card.find('.retry-container').html(retryButtonHtml);
        }
    },

    // Re-fetch the report for a single company without restarting the whole run
    retryCompany: function(companyLogin) {
        var self = this;
        var reportParams = this.reportData.reportParams;

        // Drop this company's previous error and any partial data before retrying
        this.reportData.errors = this.reportData.errors.filter(function(err) {
            return err.company !== companyLogin;
        });
        this.reportData.companies = this.reportData.companies.filter(function(companyData) {
            if (companyData.login !== companyLogin) return true;
            self.reportData.totalBookings -= companyData.bookings.length;
            return false;
        });

        this.updateCompanyStatus(companyLogin, 'bookings-generating', 'Retrying...');

        var tokenPromise = this.companyTokens[companyLogin] ?
            Promise.resolve(this.companyTokens[companyLogin]) :
            this.getCompanyToken(companyLogin).then(function(token) {
                self.companyTokens[companyLogin] = token;
                return token;
            });

        tokenPromise
            .then(function() {
                return self.collectCompanyReport(companyLogin, reportParams);
            })
            .then(function(result) {
                self.applyCompanyReportResult(companyLogin, result);
            })
            .catch(function(error) {
                self.updateCompanyStatus(companyLogin, 'bookings-error', 'Bookings failed: ' + error.message);
                self.reportData.errors.push({
                    company: companyLogin,
                    stage: 'bookings',
                    error: error.message
                });
            })
            .finally(function() {
                self.showReportResults();
            });
    },

    showReportResults: function() {
        var self = this;

        // Show summary
        var summaryHtml = `
            <p><strong>Total Bookings Collected:</strong> ${this.reportData.totalBookings}</p>
            <p><strong>Successful Companies:</strong> ${this.reportData.companies.length}/${this.reportData.reportParams.companies.length}</p>
            <p><strong>Errors:</strong> ${this.reportData.errors.length}</p>
        `;

        $('#summary-content').html(summaryHtml);
        $('#results-summary').show();

        // Show errors if any
        if (this.reportData.errors.length > 0) {
            var errorHtml = '<ul>';
            this.reportData.errors.forEach(function(error) {
                errorHtml += `<li><strong>${error.company}</strong> (${error.stage}): ${error.error}</li>`;
            });
            errorHtml += '</ul>';

            $('#error-content').html(errorHtml);
            $('#error-summary').show();
        } else {
            $('#error-summary').hide();
        }

        // Show download button if we have data
        if (this.reportData.totalBookings > 0) {
            $('#download-report').show().off('click').on('click', function() {
                self.downloadCSVReport();
            });
        }

        this.updateProgress(100, 'Report generation complete!');
    },

    showReportError: function(errorMessage) {
        $('#error-content').html(`<p>Failed to generate report: ${errorMessage}</p>`);
        $('#error-summary').show();
        this.updateProgress(0, 'Report generation failed');
    },

    downloadCSVReport: function() {
        var csv = this.generateCSV();
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');

        if (link.download !== undefined) {
            var url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', this.generateFileName());
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    },

    generateCSV: function() {
        var self = this;
        var csvRows = [];
        var headers = [];
        var headersSet = false;

        // Helper function to safely escape CSV values
        var escapeCSV = function(value) {
            if (value === null || value === undefined) return '';
            var stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return '"' + stringValue.replace(/"/g, '""') + '"';
            }
            return stringValue;
        };

        // Helper to flatten nested objects
        var flattenObject = function(obj, prefix) {
            var result = {};
            prefix = prefix || '';

            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var value = obj[key];
                    var newKey = prefix ? prefix + '_' + key : key;

                    if (value === null || value === undefined) {
                        result[newKey] = '';
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                        // Recursively flatten nested objects
                        var flattened = flattenObject(value, newKey);
                        for (var subKey in flattened) {
                            result[subKey] = flattened[subKey];
                        }
                    } else if (Array.isArray(value)) {
                        // Join arrays with semicolon
                        result[newKey] = value.join('; ');
                    } else if (typeof value === 'boolean') {
                        result[newKey] = value ? 'Yes' : 'No';
                    } else {
                        result[newKey] = value;
                    }
                }
            }

            return result;
        };

        // Process all bookings
        this.reportData.companies.forEach(function(companyData) {
            companyData.bookings.forEach(function(booking) {
                // Create extended booking object with company login
                var extendedBooking = {
                    company_login: companyData.login
                };

                // Copy all booking properties
                for (var key in booking) {
                    if (booking.hasOwnProperty(key)) {
                        extendedBooking[key] = booking[key];
                    }
                }

                // Flatten the entire booking object
                var flatBooking = flattenObject(extendedBooking);

                // Build headers from first booking
                if (!headersSet) {
                    var allKeys = Object.keys(flatBooking);

                    // Define priority fields in order
                    var priorityFields = ['company_login', 'code', 'record_date', 'date_start', 'time', 'event_name', 'unit_name', 'client_name', 'client_email'];

                    // Separate priority fields from others
                    var priorityHeaders = [];
                    var otherHeaders = [];

                    priorityFields.forEach(function(field) {
                        if (allKeys.indexOf(field) !== -1) {
                            priorityHeaders.push(field);
                        }
                    });

                    // Get remaining fields and sort them
                    allKeys.forEach(function(key) {
                        if (priorityFields.indexOf(key) === -1) {
                            otherHeaders.push(key);
                        }
                    });
                    otherHeaders.sort();

                    // Combine: priority fields first, then sorted others
                    headers = priorityHeaders.concat(otherHeaders);

                    csvRows.push(headers.map(escapeCSV).join(','));
                    headersSet = true;
                }

                // Build row with values in same order as headers
                var row = headers.map(function(header) {
                    return escapeCSV(flatBooking[header]);
                });

                csvRows.push(row.join(','));
            });
        });

        return csvRows.join('\n');
    },

    generateFileName: function() {
        var now = new Date();
        var dateStr = now.getFullYear() + '-' +
                     String(now.getMonth() + 1).padStart(2, '0') + '-' +
                     String(now.getDate()).padStart(2, '0');
        var timeStr = String(now.getHours()).padStart(2, '0') + '' +
                     String(now.getMinutes()).padStart(2, '0');

        return `booking-report-${this.config.cluster}-${dateStr}-${timeStr}.csv`;
    },

    showMessage: function(message, type) {
        // Remove existing alerts
        $('.alert-message').remove();

        var alertClass = 'alert-info';
        var icon = 'fas fa-info-circle';

        switch(type) {
            case 'success':
                alertClass = 'alert-success';
                icon = 'fas fa-check-circle';
                break;
            case 'error':
                alertClass = 'alert-danger';
                icon = 'fas fa-exclamation-triangle';
                break;
            case 'warning':
                alertClass = 'alert-warning';
                icon = 'fas fa-exclamation-circle';
                break;
        }

        var alertHtml = `
            <div class="alert ${alertClass} alert-dismissible fade show alert-message" role="alert">
                <i class="${icon} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        // Add alert to the current active step
        $('.step.active .form-signin, .step.active .form-companies, .step.active .form-signin-wide').prepend(alertHtml);

        // Auto-dismiss success messages after 5 seconds
        if (type === 'success') {
            setTimeout(function() {
                $('.alert-message').fadeOut();
            }, 5000);
        }
    },

    setLoading: function(loading) {
        var authBtn = $('#authenticate-btn');
        var spinner = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>';

        if (loading) {
            authBtn.prop('disabled', true);
            authBtn.html(spinner + 'Authenticating...');
            $('.step-1').addClass('loading');
        } else {
            authBtn.prop('disabled', false);
            authBtn.html('<i class="fas fa-key me-2"></i>Authenticate & Connect');
            $('.step-1').removeClass('loading');
        }
    },
});

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    new ReportCreator();
});
