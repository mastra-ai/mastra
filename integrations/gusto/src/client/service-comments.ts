export const comments = {
  "getV1Employees": {
    "comment": "Get an employee",
    "doc": "Get an employee\n  Get an employee.\n \n  `scope: employees.read`"
  },
  "putV1Employees": {
    "comment": "Update an employee",
    "doc": "Update an employee\n  Update an employee.\n \n  `scope: employees.write`"
  },
  "deleteV1Employee": {
    "comment": "Delete an onboarding employee",
    "doc": "Delete an onboarding employee\n  Use this endpoint to delete an employee who is in onboarding. Deleting an onboarded employee is not allowed. Please check out the Terminations api if you need to terminate an onboarded employee."
  },
  "putV1EmployeeFinishOnboarding": {
    "comment": "Finish onboarding an employee",
    "doc": "Finish onboarding an employee\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Call this endpoint as the very last step of employee onboarding to complete their onboarding. When successful, the employee's `onboarded` attribute will be updated to true, indicating that they can be included in company's payrolls."
  },
  "getV1Companies": {
    "comment": "Get a company",
    "doc": "Get a company\n  Get a company.\n \n  `scope: companies.read`"
  },
  "getV1CompanyOnboardingStatus": {
    "comment": "Get the company's onboarding status",
    "doc": "Get the company's onboarding status\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get company's onboarding status. The data returned helps inform the required onboarding steps and respective completion status."
  },
  "getV1CompanyFinishOnboarding": {
    "comment": "Finish company onboarding",
    "doc": "Finish company onboarding\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Use this endpoint to finalize company onboarding."
  },
  "getV1CompaniesCompanyIdEmployees": {
    "comment": "Get employees of a company",
    "doc": "Get employees of a company\n  Get all of the employees, onboarding, active and terminated, for a given company.\n \n  `scope: employees.read`"
  },
  "postV1Employees": {
    "comment": "Create an employee",
    "doc": "Create an employee\n  Create an employee.\n \n  `scope: employees.write`"
  },
  "getV1JobsJobId": {
    "comment": "Get a job",
    "doc": "Get a job\n  Get a job.\n \n  `scope: jobs.read`"
  },
  "putV1JobsJobId": {
    "comment": "Update a job",
    "doc": "Update a job\n  Update a job.\n \n  `scope: jobs.write`"
  },
  "deleteV1JobsJobId": {
    "comment": "Delete an individual job",
    "doc": "Delete an individual job\n  Deletes a specific job that an employee holds.\n \n  `scope: jobs.write`"
  },
  "getV1EmployeesEmployeeIdJobs": {
    "comment": "Get jobs for an employee",
    "doc": "Get jobs for an employee\n  Get all of the jobs that an employee holds.\n \n  `scope: jobs.read`"
  },
  "postV1JobsJobId": {
    "comment": "Create a job",
    "doc": "Create a job\n  Create a job.\n \n  `scope: jobs.write`"
  },
  "getV1CompaniesCompanyIdLocations": {
    "comment": "Get company locations",
    "doc": "Get company locations\n  Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n \n  Since all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n \n  `scope: companies.read`"
  },
  "postV1CompaniesCompanyIdLocations": {
    "comment": "Create a company location",
    "doc": "Create a company location\n  Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n \n  Since all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n \n  scope: companies.write"
  },
  "getV1LocationsLocationId": {
    "comment": "Get a location",
    "doc": "Get a location\n  Get a location.\n \n  `scope: companies.read`"
  },
  "putV1LocationsLocationId": {
    "comment": "Update a location",
    "doc": "Update a location\n  Update a location.\n \n  scope: companies.write"
  },
  "getV1ContractorsContractorId": {
    "comment": "Get a contractor",
    "doc": "Get a contractor\n  Get a contractor.\n \n  `scope: employees.read`"
  },
  "putV1ContractorsContractorId": {
    "comment": "Update a contractor",
    "doc": "Update a contractor\n  Update a contractor.\n \n  `scope: employees.write`"
  },
  "getV1CompaniesCompanyIdContractors": {
    "comment": "Get contractors of a company",
    "doc": "Get contractors of a company\n  Get all contractors, active and inactive, individual and business, for a company.\n \n  `scope: employees.read`"
  },
  "postV1CompaniesCompanyIdContractors": {
    "comment": "Create a contractor",
    "doc": "Create a contractor\n  Create an individual or business contractor.\n \n  `scope: employees.write`"
  },
  "getV1CompaniesCompanyIdContractorPayments": {
    "comment": "Get contractor payments for a company",
    "doc": "Get contractor payments for a company\n  Returns an object containing individual contractor payments, within a given time period, including totals.\n \n  `scope: payrolls.read`"
  },
  "postV1CompaniesCompanyIdContractorPayments": {
    "comment": "Create a contractor payment",
    "doc": "Create a contractor payment\n  Returns an object containing individual contractor payments, within a given time period, including totals.\n \n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto."
  },
  "getV1CompaniesCompanyIdContractorPaymentContractorPayment": {
    "comment": "Get a single contractor payment",
    "doc": "Get a single contractor payment\n  Returns a single contractor payments\n \n  `scope: payrolls.read`"
  },
  "deleteV1CompaniesCompanyIdContractorPaymentContractorPayment": {
    "comment": "Cancel a contractor payment",
    "doc": "Cancel a contractor payment\n  Cancels and deletes a contractor payment. If the contractor payment has already started processing, the payment cannot be cancelled.\n \n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto."
  },
  "getV1CompensationsCompensationId": {
    "comment": "Get a compensation",
    "doc": "Get a compensation\n  Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n \n  Note: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n \n  `scope: jobs.read`"
  },
  "putV1CompensationsCompensationId": {
    "comment": "Update a compensation",
    "doc": "Update a compensation\n  Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n \n  Note: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n \n  `scope: jobs.write`"
  },
  "getV1JobsJobIdCompensations": {
    "comment": "Get compensations for a job",
    "doc": "Get compensations for a job\n  Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n \n  Note: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n \n  Use the `flsa_status` to determine if an employee is elibgle for overtime.\n \n  `scope: jobs.read`"
  },
  "postV1JobsJobIdCompensations": {
    "comment": "Create a compensation",
    "doc": "Create a compensation\n  Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n \n  Note: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n \n  `scope: jobs.write`"
  },
  "getV1EmployeesEmployeeIdGarnishments": {
    "comment": "Get garnishments for an employee",
    "doc": "Get garnishments for an employee\n  Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n \n  `scope: employees.read`"
  },
  "postV1EmployeesEmployeeIdGarnishments": {
    "comment": "Create a garnishment",
    "doc": "Create a garnishment\n  Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n \n  `scope: employees.write`"
  },
  "getV1GarnishmentsGarnishmentId": {
    "comment": "Get a garnishment",
    "doc": "Get a garnishment\n  Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n \n  `scope: employees.read`"
  },
  "putV1GarnishmentsGarnishmentId": {
    "comment": "Update a garnishment",
    "doc": "Update a garnishment\n  Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n \n  `scope: employees.write`"
  },
  "getV1EmployeesEmployeeIdTerminations": {
    "comment": "Get terminations for an employee",
    "doc": "Get terminations for an employee\n  Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n \n  Note that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n \n  `scope: employees.read`"
  },
  "postV1EmployeesEmployeeIdTerminations": {
    "comment": "Create an employee termination",
    "doc": "Create an employee termination\n  Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n \n  Note that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n \n  `scope: employees.write`"
  },
  "getV1CompaniesCompanyIdTimeOffRequests": {
    "comment": "Get time off requests for a company",
    "doc": "Get time off requests for a company\n  Get all time off requests, past and present, for a company.\n \n  In order to reduce the number of time off requests returned in a single response, or to retrieve time off requests from a time period of interest, you may use the `start_date` and `end_date` parameters.\n \n  You may provide both or either parameters to scope the returned data. For example:\n \n  `?start_date='2019-01-01'`\n \n  Returns all time off requests where the request start date is equal to or after January 1, 2019.\n \n  `?end_date='2019-01-01'`\n \n  Returns all time off requests where the request end date is equal to or before January 1, 2019.\n \n  `?start_date='2019-05-01'&end_date='2019-08-31'`\n \n  Returns all time off requests where the request start date is equal to or after May 1, 2019 and the request end date is equal to or before August 31, 2019.\n \n  `scope: time_off_requests.read`"
  },
  "getV1Me": {
    "comment": "Get the current user",
    "doc": "Get the current user\n  Returns information pertaining to the user associated with the provided access token."
  },
  "getV1TermsOfService": {
    "comment": "Get the terms of service acceptance",
    "doc": "Get the terms of service acceptance\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Returns whether the latest terms of service for Gusto Embedded Payroll has been accepted by the current user."
  },
  "postV1TermsOfService": {
    "comment": "Accept the latest terms of service",
    "doc": "Accept the latest terms of service\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Accepts the latest terms of service for Gusto Embedded Payroll for the current user."
  },
  "getV1EmployeesEmployeeIdFederalTaxes": {
    "comment": "Get an employee's federal taxes",
    "doc": "Get an employee's federal taxes\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get attributes relevant for an employee's federal taxes."
  },
  "putV1EmployeesEmployeeIdFederalTaxes": {
    "comment": "Update an employee's federal taxes",
    "doc": "Update an employee's federal taxes\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Update attributes relevant for an employee's federal taxes."
  },
  "getV1EmployeesEmployeeIdStateTaxes": {
    "comment": "Get an employee's state taxes",
    "doc": "Get an employee's state taxes\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get attributes relevant for an employee's state taxes.\n \n  The data required to correctly calculate an employee's state taxes varies by both home and work location. This API returns information about each question that must be answered grouped by state. Mostly commonly, an employee lives and works in the same state and will only have questions for a single state. The response contains metadata about each question, the type of answer expected, and the current answer stored in Gusto for that question.\n \n  Answers are represented by an array. Today, this array can only be empty or contain exactly one element, but is designed to allow for forward compatibility with effective-dated fields. Until effective dated answers are supported, the `valid_from` and `valid_up_to` must always be `\"2010-01-01\"` and `null` respectively."
  },
  "putV1EmployeesEmployeeIdStateTaxes": {
    "comment": "Update an employee's state taxes",
    "doc": "Update an employee's state taxes\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Update attributes relevant for an employee's state taxes.\n \n  As described for the GET endpoint, the answers must be supplied in the effective-dated format, but currently only a single answer will be accepted - `valid_from` and `valid_up_to` must be `\"2010-01-01\"` and `null` respectively."
  },
  "getV1EmployeesEmployeeIdHomeAddress": {
    "comment": "Get an employee's home address",
    "doc": "Get an employee's home address\n  The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n \n  `scope: employees.read`"
  },
  "putV1EmployeesEmployeeIdHomeAddress": {
    "comment": "Update an employee's home address",
    "doc": "Update an employee's home address\n  The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n \n  `scope: employees.write`"
  },
  "getV1CompanyPaymentConfigs": {
    "comment": "Get a company's payment configs",
    "doc": "Get a company's payment configs\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get fast payment limit (only applicable for 2-day payroll) and payment speed for the company."
  },
  "putV1CompanyPaymentConfigs": {
    "comment": "Update a company's payment configs",
    "doc": "Update a company's payment configs\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Update fast payment limit (only applicable for 2-day payroll) and payment speed for the company."
  },
  "getV1CompaniesCompanyIdPaySchedules": {
    "comment": "Get the pay schedules for a company",
    "doc": "Get the pay schedules for a company\n  The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n \n  `scope: payrolls.read`"
  },
  "postV1CompaniesCompanyIdPaySchedules": {
    "comment": "Create a new single pay schedule",
    "doc": "Create a new single pay schedule\n  Creates a new single default pay schedule for the company.\n \n  This creates one pay schedule during company onboarding and cannot be used if the company has processed a payroll. Creating multiple pay schedules at this time is not supported. To change a pay schedule, the end user will need to login to Gusto to edit their pay schedule.\n \n  Be sure to [check state laws](https://www.dol.gov/agencies/whd/state/payday) to know what schedule is right for your customers.\n \n  This endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto"
  },
  "getV1CompanyIndustry": {
    "comment": "Get Company Industry Selection",
    "doc": "Get Company Industry Selection\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get industry selection for the company."
  },
  "putV1CompanyIndustry": {
    "comment": "Update a company industry selection",
    "doc": "Update a company industry selection\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Update the company industry selection by passing in industry classification codes: [NAICS code](https://www.naics.com), [SICS code](https://siccode.com/) and industry title. Our UI is leveraging [Middesk API](https://docs.middesk.com/reference/introduction) to determine industry classification codes."
  },
  "getV1CompaniesCompanyIdPaySchedulesPayScheduleId": {
    "comment": "Get a pay schedule",
    "doc": "Get a pay schedule\n  The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n \n  `scope: payrolls.read`"
  },
  "putV1CompaniesCompanyIdPaySchedulesPayScheduleId": {
    "comment": "Update a pay schedule",
    "doc": "Update a pay schedule\n  Updates a pay schedule.\n \n  This endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto"
  },
  "getV1CompaniesCompanyIdBankAccounts": {
    "comment": "Get all company bank accounts",
    "doc": "Get all company bank accounts\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Returns company bank accounts. Currently we only support a single default bank account per company."
  },
  "postV1CompaniesCompanyIdBankAccounts": {
    "comment": "Create a company bank account",
    "doc": "Create a company bank account\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  This endpoint creates a new company bank account.\n  If a default bank account exists, the new bank account will replace it as the company's default funding method.\n  Upon being created, two verification deposits are automatically sent to the bank account, and the bank account's verification_status is 'awaiting_deposits'.\n  When the deposits are successfully transferred, the verification_status changes to 'ready_for_verification', at which point the verify endpoint can be used to verify the bank account.\n  After successful verification, the bank account's verification_status is 'verified'."
  },
  "putV1CompaniesCompanyIdBankAccountsVerify": {
    "comment": "Verify a company bank account",
    "doc": "Verify a company bank account\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Verify a company bank account by confirming the two micro-deposits sent to the bank account. Note that the order of the two deposits specified in request parameters does not matter. There's a maximum of 5 verification attempts, after which we will automatically initiate a new set of micro-deposits and require the bank account to be verified with the new micro-deposits.\n \n  ### Bank account verification in demo\n \n  We provide the endpoint `POST '/v1/companies/{company_id_or_uuid}/bank_accounts/{bank_account_uuid}/send_test_deposits'` to facilitate bank account verification in the demo environment. This endpoint simulates the micro-deposits transfer and returns them in the reponse. You can call this endpoint as many times as you wish to retrieve the values of the two micro deposits.\n \n  ```\n  POST '/v1/companies/89771af8-b964-472e-8064-554dfbcb56d9/bank_accounts/ade55e57-4800-4059-9ecd-fa29cfeb6dd2/send_test_deposits'\n \n  {\n  \"deposit_1\": 0.02,\n  \"deposit_2\": 0.42\n  }\n  ```"
  },
  "getV1Benefits": {
    "comment": "Get all benefits supported by Gusto",
    "doc": "Get all benefits supported by Gusto\n  Returns all benefits supported by Gusto.\n \n  The benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n \n  `scope: benefits.read`"
  },
  "getV1BenefitsBenefitId": {
    "comment": "Get a supported benefit by ID",
    "doc": "Get a supported benefit by ID\n  Returns a benefit supported by Gusto.\n \n  The benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n \n  `scope: benefits.read`"
  },
  "getV1CompaniesCompanyIdCompanyBenefits": {
    "comment": "Get benefits for a company",
    "doc": "Get benefits for a company\n  Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n \n  Note that company benefits can be deactivated only when no employees are enrolled.\n \n  `scope: company_benefits.read`"
  },
  "postV1CompaniesCompanyIdCompanyBenefits": {
    "comment": "Create a company benefit",
    "doc": "Create a company benefit\n  Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n \n  Note that company benefits can be deactivated only when no employees are enrolled.\n \n  `scope: company_benefits.write`"
  },
  "getV1CompanyBenefitsCompanyBenefitId": {
    "comment": "Get a company benefit",
    "doc": "Get a company benefit\n  Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n \n  Note that company benefits can be deactivated only when no employees are enrolled.\n \n  `scope: company_benefits.read`"
  },
  "putV1CompanyBenefitsCompanyBenefitId": {
    "comment": "Update a company benefit",
    "doc": "Update a company benefit\n  Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n \n  Note that company benefits can be deactivated only when no employees are enrolled.\n \n  `scope: company_benefits:write`"
  },
  "getV1CompaniesCompanyIdEarningTypes": {
    "comment": "Get all earning types for a company",
    "doc": "Get all earning types for a company\n  A payroll item in Gusto is associated to an earning type to name the type of earning described by the payroll item.\n \n  #### Default Earning Type\n  Certain earning types are special because they have tax considerations. Those earning types are mostly the same for every company depending on its legal structure (LLC, Corporation, etc.)\n \n  #### Custom Earning Type\n  Custom earning types are all the other earning types added specifically for a company.\n \n  `scope: payrolls.read`"
  },
  "postV1CompaniesCompanyIdEarningTypes": {
    "comment": "Create a custom earning type",
    "doc": "Create a custom earning type\n  Create a custom earning type.\n \n  If an inactive earning type exists with the same name, this will reactivate it instead of creating a new one.\n \n  `scope: payrolls:write`"
  },
  "putV1CompaniesCompanyIdEarningTypesEarningTypeUuid": {
    "comment": "Update an earning type",
    "doc": "Update an earning type\n  Update an earning type.\n \n  `scope: payrolls.write`"
  },
  "deleteV1CompaniesCompanyIdEarningTypesEarningTypeUuid": {
    "comment": "Deactivate an earning type",
    "doc": "Deactivate an earning type\n  Deactivate an earning type.\n \n  `scope: payrolls.write`"
  },
  "getV1EmployeesEmployeeIdEmployeeBenefits": {
    "comment": "Get an employee's benefits",
    "doc": "Get an employee's benefits\n  Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n \n  Returns an array of all employee benefits for this employee\n \n  `scope: employee_benefits.read`"
  },
  "postV1EmployeesEmployeeIdEmployeeBenefits": {
    "comment": "Create an employee benefit",
    "doc": "Create an employee benefit\n  Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n \n  `scope: employee_benefits.write`"
  },
  "postEmployeeYtdBenefitAmountsFromDifferentCompany": {
    "comment": "Year-to-date Benefit Amounts from Different Company",
    "doc": "Year-to-date Benefit Amounts from Different Company\n  Year-to-date benefit amounts from a different company represents the amount of money added to an employees plan during a current year, made outside of the current contribution when they were employed at a different company.\n \n  `scope: employee_benefits.write`"
  },
  "getV1EmployeeBenefitsEmployeeBenefitId": {
    "comment": "Get an employee benefit",
    "doc": "Get an employee benefit\n  Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n \n  `scope: employee_benefits.read`"
  },
  "putV1EmployeeBenefitsEmployeeBenefitId": {
    "comment": "Update an employee benefit",
    "doc": "Update an employee benefit\n  Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n \n  `scope: employee_benefits.write`"
  },
  "deleteV1EmployeeBenefitsEmployeeBenefitId": {
    "comment": "Delete an employee benefit",
    "doc": "Delete an employee benefit\n  Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n \n  `scope: employee_benefits.write`"
  },
  "getV1CompaniesCompanyIdPayPeriods": {
    "comment": "Get pay periods for a company",
    "doc": "Get pay periods for a company\n  Pay periods are the foundation of payroll. Compensation, time & attendance, taxes, and expense reports all rely on when they happened. To begin submitting information for a given payroll, we need to agree on the time period.\n \n \n  By default, this endpoint returns every current and past pay period for a company. Since companies can process payroll as often as every week, there can be up to 53 pay periods a year. If a company has been running payroll with Gusto for five years, this endpoint could return up to 265 pay periods. Use the `start_date` and `end_date` parameters to reduce the scope of the response.\n \n  `scope: payrolls.read`"
  },
  "getV1CompaniesCompanyIdPayrolls": {
    "comment": "Get all payrolls for a company",
    "doc": "Get all payrolls for a company\n  Returns all payrolls, current and past for a company.\n \n  Notes:\n   Hour and dollar amounts are returned as string representations of numeric decimals.\n   Hours are represented to the thousands place; dollar amounts are represented to the cent.\n   Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n \n  `scope: payrolls.read`"
  },
  "postV1CompaniesCompanyIdPayrolls": {
    "comment": "Create an Off-Cycle Payroll",
    "doc": "Create an Off-Cycle Payroll\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Creates a new, unprocessed, off-cycle payroll."
  },
  "putV1CompaniesCompanyIdPayrolls": {
    "comment": "Update a payroll by ID",
    "doc": "Update a payroll by ID\n  This endpoint allows you to update information for one or more employees for a specific unprocessed payroll.\n \n  `scope: payrolls.write`"
  },
  "getV1CompaniesCompanyIdPayrollsPayrollId": {
    "comment": "Get a single payroll",
    "doc": "Get a single payroll\n  Returns a payroll.\n \n  Notes:\n   Hour and dollar amounts are returned as string representations of numeric decimals.\n   Hours are represented to the thousands place; dollar amounts are represented to the cent.\n   Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n \n  `scope: payrolls.read`"
  },
  "putV1CompaniesCompanyIdPayrollsPayPeriodStartDatePayPeriodEndDate": {
    "comment": "Update a payroll",
    "doc": "Update a payroll\n  This endpoint allows you to update information for one or more employees for a specific unprocessed payroll.\n \n  The payrolls are identified by their pay periods’ start_date and end_date. Both are required and must correspond with an existing, unprocessed payroll. If the dates do not match, the entire request will be rejected. This was an explicit design decision to remove any assumptions around the timespan for data sent.\n \n  `scope: payrolls.write`"
  },
  "postV1PartnerManagedCompanies": {
    "comment": "Create a partner managed company",
    "doc": "Create a partner managed company\n  This endpoint is intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  ### Overview\n \n  The partner managed company API provides a way to create a Gusto company that you can manage. This endpoint behaves similarly to [creating a company](../~1v1~1provision/post) in that it does the following:\n \n   Creates a new company in Gusto.\n   Creates a new user in Gusto.\n   Makes the new user the primary payroll administrator of the new company.\n \n  Additionally, on successful creation of the company, this API will do the following:\n   Creates a link between the partner and the company.\n   Creates access tokens and refresh tokens that can be used immediately.\n \n  In the response, you will receive the access token, the refresh token, and the uuid of the created company.\n \n  ### Authentication\n \n  Due to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n \n  ```\n  Content-Type: application/json\n  Authorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n  ```"
  },
  "postV1Provision": {
    "comment": "Create a company",
    "doc": "Create a company\n  ### Overview\n \n  The company provisioning API provides a way to create a Gusto company as part of your integration. When you successfully call the API, the API does the following:\n \n   Creates a new company in Gusto.\n   Creates a new user in Gusto.\n   Makes the new user the primary payroll administrator of the new company.\n   Sends a welcome email to the new user.\n \n  In the response, you will receive an account claim URL. Redirect the user to this URL to complete their account setup inside of Gusto\n \n  ### Authentication\n \n  Due to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n \n  ```\n  Content-Type: application/json\n  Authorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n  ```"
  },
  "getV1EmployeesEmployeeIdCustomFields": {
    "comment": "Get an employee's custom fields",
    "doc": "Get an employee's custom fields\n  Returns a list of the employee's custom fields.\n \n  `scope: employees.read`"
  },
  "getV1CompaniesCompanyIdCustomFields": {
    "comment": "Get the custom fields of a company",
    "doc": "Get the custom fields of a company\n  Returns a list of the custom fields of the company. Useful when you need to know the schema of custom fields for an entire company\n \n  `scope: companies.read`"
  },
  "getV1CompaniesCompanyIdTimeOffRequestsTimeOffRequestId": {
    "comment": "Get a specific time off request",
    "doc": "Get a specific time off request\n  Details of a single time off request\n \n  `scope: time_off_requests.read`"
  },
  "putV1CompaniesCompanyIdPayrollsPayrollIdCalculate": {
    "comment": "Calculate a Payroll",
    "doc": "Calculate a Payroll\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Performs calculations for taxes, benefits, and deductions for an unprocessed payroll. The calculated payroll details provide a preview of the actual values that will be used when the payroll is run.\n \n  This calculation is asynchronous and a sucessful request responds with a 202 HTTP status. To view the details of the calculated payroll, use the GET /v1/companies/{company_id}/payrolls/{payroll_id} endpoint with the show_calculation=true and include=taxes,benefits,deductions params.\n \n  If the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n \n  ```\n  { \"errors\": { \"missing_requirements\": [\"needs_onboarding\", \"invalid_signatory\"] } }\n  ```"
  },
  "putV1CompaniesCompanyIdPayrollsPayrollIdSubmit": {
    "comment": "Submit Payroll",
    "doc": "Submit Payroll\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Submits an unprocessed payroll to be calculated and run. This submission is asynchronous and a sucessful request responds with a 202 HTTP status. Upon success, transitions the payroll to the `processed` state.\n \n  If the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n \n  ```\n  { \"errors\": { \"missing_requirements\": [\"needs_onboarding\", \"invalid_signatory\"] } }\n  ```"
  },
  "putApiV1CompaniesCompanyIdPayrollsPayrollIdCancel": {
    "comment": "Cancel a Payroll",
    "doc": "Cancel a Payroll\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Transitions a `processed` payroll back to the `unprocessed` state. A payroll cannot be canceled once it has entered the `funded` state."
  },
  "getV1CompaniesCompanyIdOrUuidPayrollReversals": {
    "comment": "Get approved Payroll Reversals",
    "doc": "Get approved Payroll Reversals\n  Returns all approved Payroll Reversals for a Company.\n \n  `scope: payrolls.read`"
  },
  "getV1CompaniesCompanyIdAdmins": {
    "comment": "Get all the admins at a company",
    "doc": "Get all the admins at a company\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Returns a list of all the admins at a company"
  },
  "postV1CompaniesCompanyIdAdmins": {
    "comment": "Create an admin for the company.",
    "doc": "Create an admin for the company.\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Creates a new admin for a company. If the email matches an existing user, this will create an admin account for the current user. Otherwise, this will create a new user."
  },
  "getV1CompaniesCompanyIdOrUuidFederalTaxDetails": {
    "comment": "Get Federal Tax Details",
    "doc": "Get Federal Tax Details\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Fetches attributes relevant for a company's federal taxes."
  },
  "putV1CompaniesCompanyIdOrUuidFederalTaxDetails": {
    "comment": "Update Federal Tax Details",
    "doc": "Update Federal Tax Details\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Updates attributes relevant for a company's federal taxes. This information is required is to onboard a company for use with Gusto Embedded Payroll."
  },
  "getV1EmployeesEmployeeIdBankAccounts": {
    "comment": "Get all employee bank accounts",
    "doc": "Get all employee bank accounts\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Returns all employee bank accounts."
  },
  "postV1EmployeesEmployeeIdBankAccounts": {
    "comment": "Create an employee bank account",
    "doc": "Create an employee bank account\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Creates an employee bank account. An employee can have multiple bank accounts. Note that creating an employee bank account will also update the employee's payment method."
  },
  "deleteV1EmployeesEmployeeIdBankAccountsBankAccountId": {
    "comment": "Delete an employee bank account",
    "doc": "Delete an employee bank account\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Deletes an employee bank account. To update an employee's bank account details, delete the bank account first and create a new one."
  },
  "getV1EmployeesEmployeeIdPaymentMethod": {
    "comment": "Get an employee's payment method",
    "doc": "Get an employee's payment method\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Fetches an employee's payment method. An employee payment method describes how the payment should be split across the employee's associated bank accounts."
  },
  "putV1EmployeesEmployeeIdPaymentMethod": {
    "comment": "Update an employee's payment method",
    "doc": "Update an employee's payment method\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Updates an employee's payment method. Note that creating an employee bank account will also update the employee's payment method."
  },
  "postV1CompanySignatories": {
    "comment": "Create a signatory",
    "doc": "Create a signatory\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Create a company signatory with complete information. A signatory can legally sign forms once the identity verification process is successful."
  },
  "getV1CompaniesCompanyUuidSignatories": {
    "comment": "Get all company signatories",
    "doc": "Get all company signatories\n  This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Returns company signatories. Currently we only support a single signatory per company."
  },
  "getV1CompanyForms": {
    "comment": "Get all company forms",
    "doc": "Get all company forms\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get a list of all company's forms"
  },
  "getV1CompanyForm": {
    "comment": "Get a company form",
    "doc": "Get a company form\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get a company form"
  },
  "getV1CompanyFormPdf": {
    "comment": "Get a form pdf",
    "doc": "Get a form pdf\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get the link to the form PDF"
  },
  "putV1CompanyFormSign": {
    "comment": "Sign a company form",
    "doc": "Sign a company form\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Sign a company form"
  },
  "getV1EmployeeForms": {
    "comment": "Get all employee forms",
    "doc": "Get all employee forms\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get a list of all employee's forms"
  },
  "getV1EmployeeForm": {
    "comment": "Get an employee form",
    "doc": "Get an employee form\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get an employee form"
  },
  "getV1EmployeeFormPdf": {
    "comment": "Get the PDF of an employee's form",
    "doc": "Get the PDF of an employee's form\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get the link to the form PDF"
  },
  "putV1EmployeeFormSign": {
    "comment": "Sign an employee form",
    "doc": "Sign an employee form\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Sign a company form"
  },
  "postV1CompanyFlows": {
    "comment": "Create a flow",
    "doc": "Create a flow\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Generate a link to access a pre-built workflow in Gusto whitelabel UI. For security, all generated flows will expire within 1 hour of inactivity. Additionally, flows will be deactivated 24 hours from creation time. We currently support the following flow types\n  |   |   |   |   |\n  |---|---|---|---|\n  |__flow_type__|__entity_type__|__entity_uuid__|__Flow description__|\n  | company_onboarding | n/a | n/a | Full company onboarding flow |\n  | add_addresses | n/a | n/a | Manage company's work, mailing, and filing addresses |\n  | federal_tax_setup | n/a | n/a | Review and update company federal tax details |\n  | select_industry | n/a | n/a | Select the company industry |\n  | add_bank_info | n/a | n/a | Add bank info manually or via Plaid |\n  | verify_bank_info | n/a | n/a | Bank deposits verification |\n  | add_employees | n/a | n/a | Manage all employee onboarding |\n  | state_setup | n/a | n/a | Review and update company state taxes |\n  | payroll_schedule | n/a | n/a | Set company's payroll schedule |\n  | sign_all_forms | n/a | n/a | Add signatory and sign company documents |\n  | employee_form_signing | 'Employee' | employee's UUID | For employee to review and sign documents |"
  },
  "getV1PayrollsPayrollUuidEmployeesEmployeeUuidPayStub": {
    "comment": "Get an employee pay stub (pdf)",
    "doc": "Get an employee pay stub (pdf)\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Get an employee's pay stub for the specified payroll. By default, an application/pdf response will be returned. No other content types are currently supported, but may be supported in the future.\n \n  scope: `payrolls:run`"
  },
  "postV1CompaniesCompanyUuidSignatoriesInvite": {
    "comment": "Invite a signatory",
    "doc": "Invite a signatory\n  This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Create a signatory with minimal information. This signatory can be invited to provide more information through the `PUT /v1/companies/{company_uuid}/signatories/{signatory_uuid}` endpoint. This will start the identity verification process and allow the signatory to be verified to sign documents."
  },
  "putV1CompaniesCompanyUuidSignatoriesSignatoryUuid": {
    "comment": "Update a signatory",
    "doc": "Update a signatory\n  This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Update a signatory that has been either invited or created. If the signatory has been created with minimal information through the `POST /v1/companies/{company_uuid}/signatories/invite` endpoint, then the first update must contain all attributes specified in the request body in order to start the identity verification process."
  },
  "deleteV1CompaniesCompanyUuidSignatoriesSignatoryUuid": {
    "comment": "Delete a signatory",
    "doc": "Delete a signatory\n  This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n \n  Delete a company signatory."
  },
  "getV1EmployeesEmployeeIdOrUuidOnboardingStatus": {
    "comment": "Get the employee's onboarding status (Beta)",
    "doc": "Get the employee's onboarding status (Beta)\n  # Description\n  Retrieves an employee's onboarding status. The data returned helps inform the required onboarding steps and respective completion status.\n \n  ## Beta Endpoint\n  This endpoint is in beta and intended for [Gusto Embedded Payroll](https://gusto.com/embedded-payroll) customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto."
  }
}