// @ts-nocheck
export type TPaths = {
  '/v1/employees/{employee_id_or_uuid}': {
    get: {
      summary: 'Get an employee';
      operationId: 'get-v1-employees';
      description: 'Get an employee.\n\n`scope: employees.read`\n';
      parameters: [
        {
          in: 'query';
          name: 'include';
          description: 'Include the requested attribute(s) in each employee response';
          schema: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['custom_fields'];
            };
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object';
        };
      };
      tags: ['Employees'];
    };
    put: {
      summary: 'Update an employee';
      operationId: 'put-v1-employees';
      description: 'Update an employee.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                first_name: {
                  type: 'string';
                };
                middle_initial: {
                  type: 'string';
                };
                last_name: {
                  type: 'string';
                };
                date_of_birth: {
                  type: 'string';
                };
                email: {
                  type: 'string';
                };
                ssn: {
                  type: 'string';
                  pattern: '[0-9]{9}';
                };
                two_percent_shareholder: {
                  type: 'boolean';
                  description: 'Whether the employee is a two percent shareholder of the company. This field only applies to companies with an S-Corp entity type.';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: 'db0edd04aaac4506f7edab03ac855d56';
                  first_name: 'Soren';
                  middle_initial: 'A';
                  last_name: 'Kierkegaard';
                  date_of_birth: '1995-05-05';
                  email: 'knight0faith@example.com';
                  ssn: '123456294';
                  two_percent_shareholder: false;
                };
              };
            };
          };
        };
        description: 'Update an employee.';
      };
      parameters: [];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object';
        };
      };
      tags: ['Employees'];
    };
    delete: {
      summary: 'Delete an onboarding employee';
      operationId: 'delete-v1-employee';
      description: 'Use this endpoint to delete an employee who is in onboarding. Deleting an onboarded employee is not allowed. Please check out the Terminations api if you need to terminate an onboarded employee.';
      parameters: [];
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      tags: ['Employees'];
    };
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
  };
  '/v1/employees/{employee_id_or_uuid}/finish_onboarding': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    put: {
      summary: 'Finish onboarding an employee';
      operationId: 'put-v1-employee-finish-onboarding';
      parameters: [];
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCall this endpoint as the very last step of employee onboarding to complete their onboarding. When successful, the employee's `onboarded` attribute will be updated to true, indicating that they can be included in company's payrolls.";
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object';
        };
      };
      tags: ['Employees'];
    };
  };
  '/v1/companies/{company_id_or_uuid}': {
    get: {
      summary: 'Get a company';
      operationId: 'get-v1-companies';
      description: 'Get a company.\n\n`scope: companies.read`';
      parameters: [];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Object';
        };
      };
      tags: ['Companies'];
    };
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the company';
        required: true;
      },
    ];
  };
  '/v1/companies/{company_uuid}/onboarding_status': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the company';
      },
    ];
    get: {
      summary: "Get the company's onboarding status";
      operationId: 'get-v1-company-onboarding-status';
      parameters: [];
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet company's onboarding status. The data returned helps inform the required onboarding steps and respective completion status.";
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Onboarding-Status-Object';
        };
      };
      tags: ['Companies'];
    };
  };
  '/v1/companies/{company_uuid}/finish_onboarding': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the company';
      },
    ];
    put: {
      summary: 'Finish company onboarding';
      operationId: 'get-v1-company-finish-onboarding';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUse this endpoint to finalize company onboarding.';
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Onboarding-Status-Object';
        };
      };
      tags: ['Companies'];
    };
  };
  '/v1/companies/{company_id_or_uuid}/employees': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get employees of a company';
      operationId: 'get-v1-companies-company_id-employees';
      parameters: [
        {
          schema: {
            type: 'boolean';
          };
          in: 'query';
          name: 'terminated';
          description: 'Filters employees by the provided boolean';
        },
        {
          in: 'query';
          name: 'include';
          description: 'Include the requested attribute(s) in each employee response';
          schema: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['custom_fields'];
            };
          };
        },
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      description: 'Get all of the employees, onboarding, active and terminated, for a given company.\n\n`scope: employees.read`';
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-List';
        };
      };
      tags: ['Employees'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {};
            };
          };
        };
      };
    };
    post: {
      summary: 'Create an employee';
      operationId: 'post-v1-employees';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                first_name: {
                  type: 'string';
                };
                middle_initial: {
                  type: 'string';
                };
                last_name: {
                  type: 'string';
                };
                date_of_birth: {
                  type: 'string';
                };
                email: {
                  type: 'string';
                };
                ssn: {
                  type: 'string';
                  pattern: '[0-9]{9}';
                };
              };
            };
            examples: {
              Example: {
                value: {
                  first_name: 'Soren';
                  middle_initial: 'A';
                  last_name: 'Kierkegaard';
                  date_of_birth: '1995-05-05';
                  email: 'knight0faith@example.com';
                  ssn: '123456294';
                };
              };
            };
          };
        };
        description: 'Create an employee.';
      };
      parameters: [];
      description: 'Create an employee.\n\n`scope: employees.write`';
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Object';
        };
      };
      tags: ['Employees'];
    };
  };
  '/v1/jobs/{job_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'job_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the job';
      },
    ];
    get: {
      summary: 'Get a job';
      responses: {
        '200': {
          $ref: '#/components/responses/Job-Object';
        };
      };
      operationId: 'get-v1-jobs-job_id';
      parameters: [];
      description: 'Get a job.\n\n`scope: jobs.read`';
      tags: ['Jobs'];
    };
    put: {
      summary: 'Update a job';
      responses: {
        '200': {
          $ref: '#/components/responses/Job-Object';
        };
      };
      operationId: 'put-v1-jobs-job_id';
      description: 'Update a job.\n\n`scope: jobs.write`';
      parameters: [];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                title: {
                  type: 'string';
                };
                location_id: {
                  type: 'number';
                };
                hire_date: {
                  type: 'string';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: 'gr78930htutrz444kuytr3s5hgxykuveb523fwl8sir';
                  title: 'Regional Manager';
                  location_id: 1363316536327002;
                  hire_date: '2020-12-21';
                };
              };
            };
          };
        };
        description: 'Update a job.';
      };
      tags: ['Jobs'];
    };
    delete: {
      summary: 'Delete an individual job';
      tags: ['Jobs'];
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      operationId: 'delete-v1-jobs-job_id';
      description: 'Deletes a specific job that an employee holds.\n\n`scope: jobs.write`';
    };
  };
  '/v1/employees/{employee_id_or_uuid}/jobs': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The employee ID or UUID';
      },
    ];
    get: {
      summary: 'Get jobs for an employee';
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Job-List';
        };
      };
      operationId: 'get-v1-employees-employee_id-jobs';
      description: 'Get all of the jobs that an employee holds.\n\n`scope: jobs.read`';
      tags: ['Jobs'];
    };
    post: {
      summary: 'Create a job';
      responses: {
        '201': {
          $ref: '#/components/responses/Job-Object';
        };
      };
      operationId: 'post-v1-jobs-job_id';
      description: 'Create a job.\n\n`scope: jobs.write`';
      parameters: [];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                };
                location_id: {
                  type: 'number';
                };
                hire_date: {
                  type: 'string';
                };
              };
            };
            examples: {
              Example: {
                value: {
                  title: 'Regional Manager';
                  location_id: 1363316536327002;
                  hire_date: '2020-12-21';
                };
              };
            };
          };
        };
        description: 'Create a job.';
      };
      tags: ['Jobs'];
    };
  };
  '/v1/companies/{company_id_or_uuid}/locations': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get company locations';
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Location-List';
        };
      };
      operationId: 'get-v1-companies-company_id-locations';
      description: 'Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n\nSince all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n\n`scope: companies.read`';
      tags: ['Locations'];
    };
    post: {
      summary: 'Create a company location';
      responses: {
        '201': {
          $ref: '#/components/responses/Location-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-locations';
      description: 'Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n\nSince all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n\nscope: companies.write';
      parameters: [];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                phone_number: {
                  type: 'string';
                  pattern: '[0-9]{10}';
                };
                street_1: {
                  type: 'string';
                };
                street_2: {
                  type: 'string';
                  nullable: true;
                };
                city: {
                  type: 'string';
                };
                state: {
                  type: 'string';
                };
                zip: {
                  type: 'string';
                };
                country: {
                  type: 'string';
                  default: 'USA';
                };
                mailing_address: {
                  type: 'boolean';
                  description: "Specify if this location is the company's mailing address.";
                };
                filing_address: {
                  type: 'boolean';
                  description: "Specify if this location is the company's filing address.";
                };
              };
              required: ['phone_number', 'street_1', 'city', 'state', 'zip'];
            };
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383';
                  street_1: '425 2nd Street';
                  street_2: 'Suite 602';
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                  country: 'USA';
                };
              };
            };
          };
          'application/xml': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                phone_number: {
                  type: 'string';
                  minLength: 1;
                };
                street_1: {
                  type: 'string';
                  minLength: 1;
                };
                street_2: {
                  type: 'string';
                  nullable: true;
                  minLength: 1;
                };
                city: {
                  type: 'string';
                  minLength: 1;
                };
                state: {
                  type: 'string';
                  minLength: 1;
                };
                zip: {
                  type: 'string';
                  minLength: 1;
                };
                country: {
                  type: 'string';
                  minLength: 1;
                };
              };
              required: ['phone_number', 'street_1', 'street_2', 'city', 'state', 'zip', 'country'];
            };
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383';
                  street_1: '425 2nd Street';
                  street_2: 'Suite 602';
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                  country: 'USA';
                };
              };
            };
          };
        };
        description: 'Create a company location.';
      };
      tags: ['Locations'];
    };
  };
  '/v1/locations/{location_id}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'location_id';
        in: 'path';
        required: true;
        description: 'The ID of the location';
      },
    ];
    get: {
      summary: 'Get a location';
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object';
        };
      };
      operationId: 'get-v1-locations-location_id';
      description: 'Get a location.\n\n`scope: companies.read`';
      parameters: [];
      tags: ['Locations'];
    };
    put: {
      summary: 'Update a location';
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object';
        };
      };
      operationId: 'put-v1-locations-location_id';
      description: 'Update a location.\n\nscope: companies.write';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                phone_number: {
                  type: 'string';
                  pattern: '[0-9]{10}';
                };
                street_1: {
                  type: 'string';
                };
                street_2: {
                  type: 'string';
                  nullable: true;
                };
                city: {
                  type: 'string';
                };
                state: {
                  type: 'string';
                };
                zip: {
                  type: 'string';
                };
                country: {
                  type: 'string';
                };
                mailing_address: {
                  type: 'boolean';
                  description: "For a company location, specify if this location is the company's mailing address.";
                };
                filing_address: {
                  type: 'boolean';
                  description: "For a company location, specify if this location is the company's filing address.";
                };
              };
            };
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383';
                  street_1: '425 2nd Street';
                  street_2: 'Suite 602';
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                  country: 'USA';
                };
              };
            };
          };
        };
        description: 'Update a location';
      };
      tags: ['Locations'];
    };
  };
  '/v1/contractors/{contractor_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'contractor_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the contractor';
      },
    ];
    get: {
      summary: 'Get a contractor';
      tags: ['Contractors'];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Object';
        };
      };
      operationId: 'get-v1-contractors-contractor_id';
      description: 'Get a contractor.\n\n`scope: employees.read`';
    };
    put: {
      summary: 'Update a contractor';
      tags: ['Contractors'];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Object';
        };
      };
      operationId: 'put-v1-contractors-contractor_id';
      description: 'Update a contractor.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                start_date: {
                  type: 'string';
                  description: 'The day when the contractor will start working for the company.\n';
                  example: '2020-01-11';
                };
                first_name: {
                  type: 'string';
                  description: 'The contractor’s first name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                last_name: {
                  type: 'string';
                  description: 'The contractor’s last name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                middle_initial: {
                  type: 'string';
                  description: 'null\tThe contractor’s middle initial. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                wage_type: {
                  type: 'string';
                  description: 'The contractor’s wage type, either “Fixed” or “Hourly”.\n';
                  enum: ['Fixed', 'Hourly'];
                };
                hourly_rate: {
                  type: 'string';
                  description: 'The contractor’s hourly rate. This attribute is required if the wage_type is “Hourly”.';
                  example: '40.0';
                };
                business_name: {
                  type: 'string';
                  description: 'The name of the contractor business. This attribute is required for “Business” contractors and will be ignored for “Individual” contractors.';
                };
                ein: {
                  type: 'string';
                  description: 'The employer identification number of the contractor business. This attribute is optional for “Business” contractors and will be ignored for “Individual” contractors.';
                };
              };
            };
            examples: {
              'Update an Individual Contractor': {
                value: {
                  version: 'b48c46abfed1487b873b442334b3c4ff';
                  start_date: '2021-01-01';
                  first_name: 'Chanel';
                  last_name: 'Boyle';
                  middle_initial: 'X';
                  wage_type: 'Hourly';
                  hourly_rate: '20.00';
                };
              };
              'Update a Business Contractor': {
                value: {
                  version: 'b48c46abfed1487b873b442334b3c4ff';
                  start_date: '2020-01-11';
                  business_name: 'Contracting Solutions';
                  ein: '991113334';
                  wage_type: 'Fixed';
                };
              };
            };
          };
        };
        description: '';
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/contractors': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get contractors of a company';
      tags: ['Contractors'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-List';
        };
      };
      operationId: 'get-v1-companies-company_id-contractors';
      description: 'Get all contractors, active and inactive, individual and business, for a company.\n\n`scope: employees.read`';
    };
    post: {
      summary: 'Create a contractor';
      tags: ['Contractors'];
      responses: {
        '201': {
          $ref: '#/components/responses/Contractor-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-contractors';
      description: 'Create an individual or business contractor.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                type: {
                  type: 'string';
                  description: 'The contractor type, either an “Individual” or a “Business”.\n';
                  enum: ['Individual', 'Business'];
                };
                wage_type: {
                  type: 'string';
                  enum: ['Hourly', 'Fixed'];
                  description: 'The contractor’s wage type, either “Fixed” or “Hourly”.\n';
                };
                first_name: {
                  type: 'string';
                  description: 'The contractor’s first name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                last_name: {
                  type: 'string';
                  description: 'The contractor’s last_name. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                start_date: {
                  type: 'string';
                  example: '2020-10-10';
                  description: 'The day when the contractor will start working for the company.';
                };
                self_onboarding: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the contractor or the payroll admin will complete onboarding in Gusto. Self-onboarding is recommended so that contractors receive Gusto accounts. If self_onboarding is true, then email is required. ';
                };
                email: {
                  type: 'string';
                  description: 'The contractor’s email address. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                middle_initial: {
                  type: 'string';
                  description: 'The contractor’s middle initial. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.';
                };
                business_name: {
                  type: 'string';
                  description: 'The name of the contractor business. This attribute is required for “Business” contractors and will be ignored for “Individual” contractors.';
                };
                ein: {
                  type: 'string';
                  description: 'The employer identification number of the contractor business. This attribute is optional for “Business” contractors and will be ignored for “Individual” contractors.';
                };
              };
              required: ['type', 'wage_type', 'start_date'];
            };
            examples: {
              'Create an Individual contractor': {
                value: {
                  type: 'Individual';
                  wage_type: 'Fixed';
                  first_name: 'Johnson';
                  last_name: 'Johnson';
                  start_date: '2020-04-01';
                  self_onboarding: true;
                  email: 'johnson@johnson.com';
                };
              };
              'Create a Business contractor': {
                value: {
                  type: 'Business';
                  wage_type: 'Fixed';
                  business_name: 'Johnson-Johnson Contractors';
                  start_date: '2020-04-01';
                };
              };
            };
          };
        };
        description: 'Create an individual or business contractor.';
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/contractor_payments': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get contractor payments for a company';
      tags: ['Contractor Payments'];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payments';
        };
      };
      operationId: 'get-v1-companies-company_id-contractor_payments';
      description: 'Returns an object containing individual contractor payments, within a given time period, including totals.\n\n`scope: payrolls.read`';
      parameters: [
        {
          schema: {
            type: 'string';
            example: '2020-01-01';
          };
          in: 'query';
          name: 'start_date';
          description: 'The time period for which to retrieve contractor payments';
          required: true;
        },
        {
          schema: {
            type: 'string';
            example: '2020-12-31';
          };
          in: 'query';
          name: 'end_date';
          description: 'The time period for which to retrieve contractor payments';
          required: true;
        },
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
    };
    post: {
      summary: 'Create a contractor payment';
      tags: ['Contractor Payments'];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payment-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-contractor_payments';
      description: 'Returns an object containing individual contractor payments, within a given time period, including totals.\n\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.';
      parameters: [
        {
          schema: {
            type: 'string';
            example: '2020-01-01';
          };
          in: 'query';
          required: true;
          name: 'date';
          description: 'The payment date';
        },
        {
          schema: {
            type: 'number';
            example: 7757515807748202;
          };
          in: 'query';
          required: true;
          name: 'contractor_id';
          description: 'The contractor receiving the payment';
        },
        {
          schema: {
            type: 'number';
            example: 5000;
          };
          in: 'query';
          name: 'wage';
          description: 'If the contractor is on a fixed wage, this is the fixed wage payment for the contractor, regardless of hours worked.';
        },
        {
          schema: {
            type: 'number';
            example: 40;
          };
          in: 'query';
          name: 'hours';
          description: 'If the contractor is on an hourly wage, this is the number of hours that the contractor worked for the payment.';
        },
        {
          schema: {
            type: 'number';
            example: 500;
          };
          in: 'query';
          name: 'bonus';
          description: 'If the contractor is on an hourly wage, this is the bonus the contractor earned.';
        },
        {
          schema: {
            type: 'number';
            example: 20;
          };
          in: 'query';
          name: 'reimbursement';
          description: 'Reimbursed wages for the contractor .';
        },
      ];
    };
  };
  '/v1/companies/{company_id_or_uuid}/contractor_payments/{contractor_payment_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'contractor_payment_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the contractor payment';
      },
    ];
    get: {
      summary: 'Get a single contractor payment';
      tags: ['Contractor Payments'];
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payment-Object';
        };
      };
      operationId: 'get-v1-companies-company_id-contractor_payment-contractor-payment';
      description: 'Returns a single contractor payments\n\n`scope: payrolls.read`';
    };
    delete: {
      summary: 'Cancel a contractor payment';
      tags: ['Contractor Payments'];
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      operationId: 'delete-v1-companies-company_id-contractor_payment-contractor-payment';
      description: 'Cancels and deletes a contractor payment. If the contractor payment has already started processing, the payment cannot be cancelled.\n\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.';
      'x-internal': false;
    };
  };
  '/v1/compensations/{compensation_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'compensation_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the compensation';
      },
    ];
    get: {
      summary: 'Get a compensation';
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-Object';
        };
      };
      operationId: 'get-v1-compensations-compensation_id';
      description: 'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n\n`scope: jobs.read`\n';
      tags: ['Compensations'];
    };
    put: {
      summary: 'Update a compensation';
      tags: ['Compensations'];
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-Object';
        };
      };
      operationId: 'put-v1-compensations-compensation_id';
      description: 'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n\n`scope: jobs.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                  readOnly: true;
                };
                rate: {
                  type: 'string';
                  readOnly: false;
                  description: 'The dollar amount paid per payment unit.';
                };
                payment_unit: {
                  type: 'string';
                  readOnly: false;
                  description: "The unit accompanying the compensation rate. If the employee is an owner, rate should be 'Paycheck'.";
                  enum: ['Hour', 'Week', 'Month', 'Year', 'Paycheck'];
                };
                flsa_status: {
                  type: 'string';
                  readOnly: false;
                  description: "The FLSA status for this compensation. Salaried ('Exempt') employees are paid a fixed salary every pay period. Salaried with overtime ('Salaried Nonexempt') employees are paid a fixed salary every pay period, and receive overtime pay when applicable. Hourly ('Nonexempt') employees are paid for the hours they work, and receive overtime pay when applicable. Owners ('Owner') are employees that own at least twenty percent of the company. ";
                  enum: ['Exempt', 'Salaried Nonexempt', 'Nonexempt', 'Owner'];
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                  rate: '60000.00';
                  payment_unit: 'Year';
                  flsa_status: 'Exempt';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/jobs/{job_id_or_uuid}/compensations': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'job_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the job to which the compensation belongs';
      },
    ];
    get: {
      summary: 'Get compensations for a job';
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-List';
        };
      };
      operationId: 'get-v1-jobs-job_id-compensations';
      description: 'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n\nUse the `flsa_status` to determine if an employee is elibgle for overtime.\n\n`scope: jobs.read`';
      tags: ['Compensations'];
    };
    post: {
      summary: 'Create a compensation';
      tags: ['Jobs'];
      operationId: 'post-v1-jobs-job_id-compensations';
      description: 'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n\n`scope: jobs.write`';
      responses: {
        '201': {
          $ref: '#/components/responses/Compensation-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                rate: {
                  type: 'string';
                  readOnly: false;
                  description: 'The dollar amount paid per payment unit.';
                };
                payment_unit: {
                  type: 'string';
                  readOnly: false;
                  description: "The unit accompanying the compensation rate. If the employee is an owner, rate should be 'Paycheck'.";
                  enum: ['Hour', 'Week', 'Month', 'Year', 'Paycheck'];
                };
                flsa_status: {
                  type: 'string';
                  readOnly: false;
                  description: "The FLSA status for this compensation. Salaried ('Exempt') employees are paid a fixed salary every pay period. Salaried with overtime ('Salaried Nonexempt') employees are paid a fixed salary every pay period, and receive overtime pay when applicable. Hourly ('Nonexempt') employees are paid for the hours they work, and receive overtime pay when applicable. Owners ('Owner') are employees that own at least twenty percent of the company. ";
                  enum: ['Exempt', 'Salaried Nonexempt', 'Nonexempt', 'Owner'];
                };
                effective_date: {
                  type: 'string';
                  description: "The effective date for this compensation. For the first compensation, this defaults to the job's hire date.";
                };
              };
              required: ['rate', 'payment_unit', 'flsa_status'];
            };
            examples: {
              Example: {
                value: {
                  rate: '60000.00';
                  payment_unit: 'Year';
                  flsa_status: 'Exempt';
                  effective_date: '2020-03-15';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/garnishments': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee to which the garnishment belongs';
      },
    ];
    get: {
      summary: 'Get garnishments for an employee';
      tags: ['Garnishments'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-List';
        };
      };
      operationId: 'get-v1-employees-employee_id-garnishments';
      description: 'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.read`';
    };
    post: {
      summary: 'Create a garnishment';
      tags: ['Garnishments'];
      responses: {
        '201': {
          $ref: '#/components/responses/Garnishment-Object';
        };
      };
      operationId: 'post-v1-employees-employee_id-garnishments';
      description: 'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                active: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether or not this garnishment is currently active.';
                };
                amount: {
                  type: 'string';
                  format: 'float';
                  readOnly: false;
                  description: 'The amount of the garnishment. Either a percentage or a fixed dollar amount. Represented as a float, e.g. "8.00".';
                };
                description: {
                  type: 'string';
                  readOnly: false;
                  description: 'The description of the garnishment.';
                };
                court_ordered: {
                  type: 'boolean';
                  readOnly: false;
                  description: 'Whether the garnishment is court ordered.';
                };
                times: {
                  type: 'integer';
                  readOnly: false;
                  default: null;
                  nullable: true;
                  description: 'The number of times to apply the garnisment. Ignored if recurring is true.';
                };
                recurring: {
                  type: 'boolean';
                  readOnly: false;
                  default: false;
                  description: 'Whether the garnishment should recur indefinitely.';
                };
                annual_maximum: {
                  format: 'float';
                  readOnly: false;
                  default: null;
                  nullable: true;
                  description: 'The maximum deduction per annum. A null value indicates no maximum. Represented as a float, e.g. "200.00".';
                  type: 'string';
                };
                pay_period_maximum: {
                  type: 'string';
                  format: 'float';
                  default: null;
                  nullable: true;
                  description: 'The maximum deduction per pay period. A null value indicates no maximum. Represented as a float, e.g. "16.00".';
                };
                deduct_as_percentage: {
                  type: 'boolean';
                  readOnly: false;
                  default: false;
                  description: 'Whether the amount should be treated as a percentage to be deducted per pay period.';
                };
              };
              required: ['amount', 'description', 'court_ordered'];
            };
            examples: {
              Example: {
                value: {
                  amount: '150.00';
                  description: 'Back taxes';
                  court_ordered: true;
                  recurring: true;
                  deduct_as_percentage: false;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/garnishments/{garnishment_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'garnishment_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the garnishment';
      },
    ];
    get: {
      summary: 'Get a garnishment';
      tags: ['Garnishments'];
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-Object';
        };
      };
      operationId: 'get-v1-garnishments-garnishment_id';
      description: 'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.read`';
    };
    put: {
      summary: 'Update a garnishment';
      tags: ['Garnishments'];
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-Object';
        };
      };
      operationId: 'put-v1-garnishments-garnishment_id';
      description: 'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                active: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether or not this garnishment is currently active.';
                };
                amount: {
                  type: 'string';
                  format: 'float';
                  readOnly: false;
                  description: 'The amount of the garnishment. Either a percentage or a fixed dollar amount. Represented as a float, e.g. "8.00".';
                };
                description: {
                  type: 'string';
                  readOnly: false;
                  description: 'The description of the garnishment.';
                };
                court_ordered: {
                  type: 'boolean';
                  readOnly: false;
                  description: 'Whether the garnishment is court ordered.';
                };
                times: {
                  type: 'integer';
                  readOnly: false;
                  default: null;
                  nullable: true;
                  description: 'The number of times to apply the garnisment. Ignored if recurring is true.';
                };
                recurring: {
                  type: 'boolean';
                  readOnly: false;
                  default: false;
                  description: 'Whether the garnishment should recur indefinitely.';
                };
                annual_maximum: {
                  format: 'float';
                  readOnly: false;
                  default: null;
                  nullable: true;
                  description: 'The maximum deduction per annum. A null value indicates no maximum. Represented as a float, e.g. "200.00".';
                  type: 'string';
                };
                pay_period_maximum: {
                  type: 'string';
                  format: 'float';
                  default: null;
                  nullable: true;
                  description: 'The maximum deduction per pay period. A null value indicates no maximum. Represented as a float, e.g. "16.00".';
                };
                deduct_as_percentage: {
                  type: 'boolean';
                  readOnly: false;
                  default: false;
                  description: 'Whether the amount should be treated as a percentage to be deducted per pay period.';
                };
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '52b7c567242cb7452e89ba2bc02cb476';
                  active: false;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/terminations': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    get: {
      summary: 'Get terminations for an employee';
      tags: ['Terminations'];
      responses: {
        '200': {
          $ref: '#/components/responses/Termination-List';
        };
      };
      operationId: 'get-v1-employees-employee_id-terminations';
      description: 'Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n\nNote that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n\n`scope: employees.read`';
    };
    post: {
      summary: 'Create an employee termination';
      tags: ['Terminations'];
      responses: {
        '201': {
          $ref: '#/components/responses/Termination-Object';
        };
      };
      operationId: 'post-v1-employees-employee_id-terminations';
      description: 'Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n\nNote that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                effective_date: {
                  type: 'string';
                  description: "The employee's last day of work.";
                };
                run_termination_payroll: {
                  type: 'boolean';
                  description: 'If true, the employee should recieve their final wages via an offcycle payroll. If false, they should recieve their final wages on their current pay schedule.';
                };
              };
            };
            examples: {
              Example: {
                value: {
                  effective_date: '2020-06-30';
                  run_termination_payroll: true;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/time_off_requests': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get time off requests for a company';
      tags: ['Time Off Requests'];
      responses: {
        '200': {
          $ref: '#/components/responses/Time-Off-Request-List';
        };
      };
      operationId: 'get-v1-companies-company_id-time_off_requests';
      description: "Get all time off requests, past and present, for a company.\n\nIn order to reduce the number of time off requests returned in a single response, or to retrieve time off requests from a time period of interest, you may use the `start_date` and `end_date` parameters.\n\nYou may provide both or either parameters to scope the returned data. For example:\n\n`?start_date='2019-01-01'`\n\nReturns all time off requests where the request start date is equal to or after January 1, 2019.\n\n`?end_date='2019-01-01'`\n\nReturns all time off requests where the request end date is equal to or before January 1, 2019.\n\n`?start_date='2019-05-01'&end_date='2019-08-31'`\n\nReturns all time off requests where the request start date is equal to or after May 1, 2019 and the request end date is equal to or before August 31, 2019.\n\n`scope: time_off_requests.read`";
      parameters: [
        {
          schema: {
            type: 'string';
            example: '"2019-05-01"';
          };
          in: 'query';
          name: 'start_date';
          description: 'Filter time off requests where the request start date is equal to or after this parameter';
        },
        {
          schema: {
            type: 'string';
            example: '"2019-08-31"';
          };
          in: 'query';
          name: 'end_date';
          description: 'Filter time off requests where the request end date is equal to or after this parameter';
        },
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
    };
  };
  '/v1/me': {
    get: {
      summary: 'Get the current user';
      tags: ['Current User'];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Current-User';
              };
              examples: {
                Example: {
                  value: {
                    id: 1409720965546346;
                    email: 'torrance.considine1409720965546346@schuster.info';
                    roles: {
                      payroll_admin: {
                        companies: [
                          {
                            id: 1409720965614302;
                            name: 'Crist-Balistreri Group';
                            tier: 'core';
                            trade_name: 'Wyman and Sons LLC';
                            locations: [
                              {
                                id: 1409721224078163;
                                street_1: '63932 Jalyn Springs';
                                street_2: 'Apt. 445';
                                city: 'Cannon Beach';
                                state: 'OR';
                                zip: '97110';
                                country: 'USA';
                                active: true;
                              },
                              {
                                id: 1409721315748742;
                                street_1: '1152 River Villages';
                                street_2: 'Apt. 563';
                                city: 'Cannon Beach';
                                state: 'OR';
                                zip: '97110';
                                country: 'USA';
                                active: true;
                              },
                            ];
                          },
                        ];
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'get-v1-me';
      description: 'Returns information pertaining to the user associated with the provided access token.';
    };
  };
  '/v1/terms_of_service': {
    get: {
      summary: 'Get the terms of service acceptance';
      tags: ['Terms of Service (Beta)'];
      responses: {
        '200': {
          description: 'Example response';
          content: {
            'application/json': {
              schema: {
                description: '';
                type: 'object';
                properties: {
                  latest_terms_accepted: {
                    type: 'boolean';
                    description: 'Whether the latest terms have been accepted by the user.';
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    latest_terms_accepted: true;
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'get-v1-terms-of-service';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns whether the latest terms of service for Gusto Embedded Payroll has been accepted by the current user.';
    };
    post: {
      summary: 'Accept the latest terms of service';
      tags: ['Terms of Service (Beta)'];
      responses: {
        '200': {
          description: 'Example response';
          content: {
            'application/json': {
              schema: {
                description: '';
                type: 'object';
                properties: {
                  latest_terms_accepted: {
                    type: 'boolean';
                    description: 'Whether the latest terms have been accepted by the user.';
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    latest_terms_accepted: true;
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'post-v1-terms-of-service';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nAccepts the latest terms of service for Gusto Embedded Payroll for the current user.';
    };
  };
  '/v1/employees/{employee_uuid}/federal_taxes': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the employee';
      },
    ];
    get: {
      summary: "Get an employee's federal taxes";
      tags: ['Employee Federal Tax'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Federal-Tax-Object';
        };
      };
      operationId: 'get-v1-employees-employee_id-federal_taxes';
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet attributes relevant for an employee's federal taxes.";
    };
    put: {
      summary: "Update an employee's federal taxes";
      tags: ['Employee Federal Tax'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Federal-Tax-Object';
        };
      };
      operationId: 'put-v1-employees-employee_id-federal_taxes';
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate attributes relevant for an employee's federal taxes.";
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                filing_status: {
                  type: 'string';
                };
                extra_withholding: {
                  type: 'string';
                  nullable: true;
                };
                two_jobs: {
                  type: 'boolean';
                };
                dependents_amount: {
                  type: 'string';
                };
                other_income: {
                  type: 'string';
                };
                deductions: {
                  type: 'string';
                };
                w4_data_type: {
                  type: 'string';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '56a489ce86ed6c1b0f0cecc4050a0b01';
                  filing_status: 'Single';
                  extra_withholding: '0.0';
                  two_jobs: true;
                  dependents_amount: '0.0';
                  other_income: '0.0';
                  deductions: '0.0';
                  w4_data_type: 'rev_2020_w4';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_uuid}/state_taxes': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the employee';
      },
    ];
    get: {
      summary: "Get an employee's state taxes";
      tags: ['Employee State Tax'];
      operationId: 'get-v1-employees-employee_id-state_taxes';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet attributes relevant for an employee\'s state taxes.\n\nThe data required to correctly calculate an employee\'s state taxes varies by both home and work location. This API returns information about each question that must be answered grouped by state. Mostly commonly, an employee lives and works in the same state and will only have questions for a single state. The response contains metadata about each question, the type of answer expected, and the current answer stored in Gusto for that question.\n\nAnswers are represented by an array. Today, this array can only be empty or contain exactly one element, but is designed to allow for forward compatibility with effective-dated fields. Until effective dated answers are supported, the `valid_from` and `valid_up_to` must always be `"2010-01-01"` and `null` respectively.\n';
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-State-Taxes-List';
        };
      };
    };
    put: {
      summary: "Update an employee's state taxes";
      tags: ['Employee State Tax'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-State-Taxes-List';
        };
        '422': {
          description: 'Unprocessable Entity (WebDAV)';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                description: '';
                uniqueItems: true;
                'x-examples': {
                  'example-1': [
                    {
                      state: 'CA';
                      questions: [
                        {
                          key: 'filing_status';
                          answers: [
                            {
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                              errors: ['string'];
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
                items: {
                  type: 'object';
                  properties: {
                    state: {
                      type: 'string';
                    };
                    questions: {
                      type: 'array';
                      uniqueItems: true;
                      items: {
                        type: 'object';
                        properties: {
                          key: {
                            type: 'string';
                          };
                          answers: {
                            type: 'array';
                            uniqueItems: true;
                            items: {
                              type: 'object';
                              properties: {
                                valid_from: {
                                  type: 'string';
                                };
                                valid_up_to: {
                                  nullable: true;
                                };
                                errors: {
                                  type: 'array';
                                  items: {
                                    type: 'string';
                                  };
                                };
                              };
                              required: ['valid_from'];
                            };
                          };
                        };
                        required: ['key'];
                      };
                    };
                  };
                  required: ['state', 'questions'];
                };
              };
              examples: {
                'Employee-State-Taxes-Error-Response': {
                  value: [
                    {
                      state: 'CA';
                      questions: [
                        {
                          key: 'filing_status';
                          answers: [
                            {
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                              errors: ['string'];
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
      operationId: 'put-v1-employees-employee_id-state_taxes';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate attributes relevant for an employee\'s state taxes.\n\nAs described for the GET endpoint, the answers must be supplied in the effective-dated format, but currently only a single answer will be accepted - `valid_from` and `valid_up_to` must be `"2010-01-01"` and `null` respectively.\n';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              'x-examples': {
                'example-1': {
                  employee_id: '87156178-62f8-46d4-a026-ed9de3e8f836';
                  states: [
                    {
                      state: 'CA';
                      questions: [
                        {
                          key: 'filing_status';
                          answers: [
                            {
                              value: 'M';
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                        {
                          key: 'withholding_allowance';
                          answers: [
                            {
                              value: 2;
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                        {
                          key: 'additional_withholding';
                          answers: [
                            {
                              value: '25.0';
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
              };
              properties: {
                employee_id: {
                  type: 'string';
                };
                states: {
                  type: 'array';
                  uniqueItems: true;
                  items: {
                    type: 'object';
                    properties: {
                      state: {
                        type: 'string';
                      };
                      questions: {
                        type: 'array';
                        uniqueItems: true;
                        items: {
                          type: 'object';
                          properties: {
                            key: {
                              type: 'string';
                            };
                            answers: {
                              type: 'array';
                              uniqueItems: true;
                              items: {
                                type: 'object';
                                properties: {
                                  value: {
                                    type: 'string';
                                  };
                                  valid_from: {
                                    type: 'string';
                                  };
                                  valid_up_to: {
                                    nullable: true;
                                  };
                                };
                                required: ['value', 'valid_from'];
                              };
                            };
                          };
                          required: ['key'];
                        };
                      };
                    };
                    required: ['state'];
                  };
                };
              };
              required: ['employee_id', 'states'];
            };
            examples: {
              'Employee-State-Taxes-Update-Example': {
                value: {
                  employee_id: '87156178-62f8-46d4-a026-ed9de3e8f836';
                  states: [
                    {
                      state: 'CA';
                      questions: [
                        {
                          key: 'filing_status';
                          answers: [
                            {
                              value: 'M';
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                        {
                          key: 'withholding_allowance';
                          answers: [
                            {
                              value: 2;
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                        {
                          key: 'additional_withholding';
                          answers: [
                            {
                              value: '25.0';
                              valid_from: '2010-01-01';
                              valid_up_to: null;
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/home_address': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    get: {
      summary: "Get an employee's home address";
      tags: ['Employees'];
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object';
        };
      };
      operationId: 'get-v1-employees-employee_id-home_address';
      description: 'The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n\n`scope: employees.read`';
    };
    put: {
      summary: "Update an employee's home address";
      tags: ['Employees'];
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object';
        };
      };
      operationId: 'put-v1-employees-employee_id-home_address';
      description: 'The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n\n`scope: employees.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                street_1: {
                  type: 'string';
                };
                street_2: {
                  type: 'string';
                  nullable: true;
                };
                city: {
                  type: 'string';
                };
                state: {
                  type: 'string';
                };
                zip: {
                  type: 'string';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: 'fe75bd065ff48b91c35fe8ff842f986c';
                  street_1: '300 3rd Street';
                  street_2: null;
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_uuid}/payment_configs': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        description: 'The UUID of the company';
        required: true;
      },
    ];
    get: {
      summary: "Get a company's payment configs";
      tags: ['Payment Configs (Beta)'];
      operationId: 'get-v1-company-payment-configs';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet fast payment limit (only applicable for 2-day payroll) and payment speed for the company.';
      responses: {
        '200': {
          $ref: '#/components/responses/Payment-Configs-Object';
        };
      };
    };
    put: {
      summary: "Update a company's payment configs";
      tags: ['Payment Configs (Beta)'];
      operationId: 'put-v1-company-payment-configs';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate fast payment limit (only applicable for 2-day payroll) and payment speed for the company.';
      responses: {
        '200': {
          $ref: '#/components/responses/Payment-Configs-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                fast_payment_limit: {
                  type: 'integer';
                  description: 'Fast payment limit (only applicable to 2-day payroll). This limit is an aggregate of all fast payrolls amount.';
                };
                payment_speed: {
                  type: 'string';
                  description: 'The payment speed';
                  enum: ['2-day', '4-day'];
                };
              };
              required: ['fast_payment_limit', 'payment_speed'];
            };
            examples: {
              Example: {
                value: {
                  fast_payment_limit: 5000;
                  payment_speed: '2-day';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/pay_schedules': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get the pay schedules for a company';
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-List';
        };
      };
      operationId: 'get-v1-companies-company_id-pay_schedules';
      description: 'The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n\n`scope: payrolls.read`';
      tags: ['Pay Schedules'];
    };
    post: {
      summary: 'Create a new single pay schedule';
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-pay_schedules';
      description: 'Creates a new single default pay schedule for the company.\n\nThis creates one pay schedule during company onboarding and cannot be used if the company has processed a payroll. Creating multiple pay schedules at this time is not supported. To change a pay schedule, the end user will need to login to Gusto to edit their pay schedule.\n\nBe sure to **[check state laws](https://www.dol.gov/agencies/whd/state/payday)** to know what schedule is right for your customers.\n\nThis endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto';
      tags: ['Pay Schedules'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                frequency: {
                  type: 'string';
                  description: 'The frequency that employees on this pay schedule are paid with Gusto.';
                  enum: ['Every week', 'Every other week', 'Twice per month', 'Monthly'];
                };
                anchor_pay_date: {
                  type: 'string';
                  description: 'The first date that employees on this pay schedule are paid with Gusto.';
                };
                anchor_end_of_pay_period: {
                  type: 'string';
                  description: 'The last date of the first pay period. This can be the same date as the anchor pay date.';
                };
                day_1: {
                  type: 'integer';
                  description: 'An integer between 1 and 31 indicating the first day of the month that employees are paid. This field is only relevant for pay schedules with the “Twice per month” and “Monthly” frequencies. It will be null for pay schedules with other frequencies.';
                  nullable: true;
                };
                day_2: {
                  description: 'An integer between 1 and 31 indicating the second day of the month that employees are paid. This field is the second pay date for pay schedules with the “Twice per month” frequency. It will be null for pay schedules with other frequencies.';
                  type: 'integer';
                  nullable: true;
                };
              };
              required: ['frequency', 'anchor_pay_date', 'anchor_end_of_pay_period'];
            };
            examples: {
              Example: {
                value: {
                  frequency: 'Twice per month';
                  anchor_pay_date: '2021-10-15';
                  anchor_end_of_pay_period: '2021-10-15';
                  day_1: 15;
                  day_2: 31;
                  auto_pilot: false;
                  version: '68934a3e9455fa72420237eb05902327';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/industry_selection': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the company';
        required: true;
      },
    ];
    get: {
      summary: 'Get Company Industry Selection';
      tags: ['Industry'];
      operationId: 'get-v1-company-industry';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet industry selection for the company.';
      responses: {
        '200': {
          $ref: '#/components/responses/Industry-Object';
        };
      };
    };
    put: {
      summary: 'Update a company industry selection';
      tags: ['Industry'];
      operationId: 'put-v1-company-industry';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate the company industry selection by passing in industry classification codes: [NAICS code](https://www.naics.com), [SICS code](https://siccode.com/) and industry title. Our UI is leveraging [Middesk API](https://docs.middesk.com/reference/introduction) to determine industry classification codes.';
      responses: {
        '200': {
          $ref: '#/components/responses/Industry-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  description: 'Industry title';
                };
                naics_code: {
                  type: 'string';
                  description: 'North American Industry Classification System (NAICS) is used to classify businesses with a six digit number based on the primary type of work the business performs';
                };
                sic_codes: {
                  type: 'array';
                  items: {
                    type: 'string';
                  };
                  description: 'A list of Standard Industrial Classification (SIC) codes, which are four digit number that categorize the industries that companies belong to based on their business activities.';
                };
              };
              required: ['title', 'naics_code', 'sic_codes'];
            };
            examples: {
              Example: {
                value: {
                  title: 'Computer Training';
                  naics_code: '611420';
                  sic_codes: ['8243'];
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/pay_schedules/{pay_schedule_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'pay_schedule_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the pay schedule';
      },
    ];
    get: {
      summary: 'Get a pay schedule';
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object';
        };
      };
      operationId: 'get-v1-companies-company_id-pay_schedules-pay_schedule_id';
      description: 'The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n\n`scope: payrolls.read`';
      tags: ['Pay Schedules'];
    };
    put: {
      summary: 'Update a pay schedule';
      tags: ['Pay Schedules'];
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object';
        };
      };
      operationId: 'put-v1-companies-company_id-pay_schedules-pay_schedule_id';
      description: 'Updates a pay schedule.\n\nThis endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                auto_pilot: {
                  type: 'boolean';
                  description: 'With Autopilot® enabled, payroll will run automatically one day before your payroll deadlines.';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                  auto_pilot: true;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/bank_accounts': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get all company bank accounts';
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Bank-Account-List';
        };
      };
      operationId: 'get-v1-companies-company_id-bank-accounts';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns company bank accounts. Currently we only support a single default bank account per company.';
      tags: ['Company Bank Accounts'];
    };
    post: {
      summary: 'Create a company bank account';
      operationId: 'post-v1-companies-company_id-bank-accounts';
      tags: ['Company Bank Accounts'];
      responses: {
        '201': {
          $ref: '#/components/responses/Company-Bank-Account-Object';
        };
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nThis endpoint creates a new company bank account.\nIf a default bank account exists, the new bank account will replace it as the company's default funding method.\nUpon being created, two verification deposits are automatically sent to the bank account, and the bank account's verification_status is 'awaiting_deposits'.\nWhen the deposits are successfully transferred, the verification_status changes to 'ready_for_verification', at which point the verify endpoint can be used to verify the bank account.\nAfter successful verification, the bank account's verification_status is 'verified'.";
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                routing_number: {
                  type: 'string';
                  nullable: false;
                  description: 'The bank routing number';
                };
                account_number: {
                  type: 'string';
                  nullable: false;
                  description: 'The bank account number';
                };
                account_type: {
                  type: 'string';
                  nullable: false;
                  description: 'The bank account type';
                  enum: ['Checking', 'Savings'];
                };
              };
            };
            examples: {
              Example: {
                value: {
                  routing_number: '115092013';
                  account_type: 'Checking';
                  account_number: '9775014007';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/bank_accounts/{bank_account_uuid}/verify': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the bank account';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'bank_account_uuid';
        in: 'path';
        required: true;
        description: 'Bank account UUID';
      },
    ];
    put: {
      summary: 'Verify a company bank account';
      operationId: 'put-v1-companies-company_id-bank-accounts-verify';
      tags: ['Company Bank Accounts'];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Bank-Account-Object';
        };
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nVerify a company bank account by confirming the two micro-deposits sent to the bank account. Note that the order of the two deposits specified in request parameters does not matter. There's a maximum of 5 verification attempts, after which we will automatically initiate a new set of micro-deposits and require the bank account to be verified with the new micro-deposits.\n\n### Bank account verification in demo\n\nWe provide the endpoint `POST '/v1/companies/{company_id_or_uuid}/bank_accounts/{bank_account_uuid}/send_test_deposits'` to facilitate bank account verification in the demo environment. This endpoint simulates the micro-deposits transfer and returns them in the reponse. You can call this endpoint as many times as you wish to retrieve the values of the two micro deposits.\n\n```\n  POST '/v1/companies/89771af8-b964-472e-8064-554dfbcb56d9/bank_accounts/ade55e57-4800-4059-9ecd-fa29cfeb6dd2/send_test_deposits'\n\n  {\n    \"deposit_1\": 0.02,\n    \"deposit_2\": 0.42\n  }\n```";
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                deposit_1: {
                  type: 'number';
                  nullable: false;
                  description: 'The dollar amount of the first micro-deposit';
                };
                deposit_2: {
                  type: 'number';
                  nullable: false;
                  description: 'The dollar amount of the second micro-deposit';
                };
              };
            };
            examples: {
              Example: {
                value: {
                  deposit_1: 0.02;
                  deposit_2: 0.42;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/benefits': {
    get: {
      summary: 'Get all benefits supported by Gusto';
      responses: {
        '200': {
          $ref: '#/components/responses/Supported-Benefit-List';
        };
      };
      operationId: 'get-v1-benefits';
      description: 'Returns all benefits supported by Gusto.\n\nThe benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n\n`scope: benefits.read`';
      tags: ['Benefits'];
    };
  };
  '/v1/benefits/{benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'benefit_id';
        in: 'path';
        required: true;
        description: 'The ID of the benefit';
      },
    ];
    get: {
      operationId: 'get-v1-benefits-benefit_id';
      summary: 'Get a supported benefit by ID';
      description: 'Returns a benefit supported by Gusto.\n\nThe benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n\n`scope: benefits.read`';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Supported-Benefit-Object';
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/company_benefits': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get benefits for a company';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-List';
        };
      };
      operationId: 'get-v1-companies-company_id-company_benefits';
      description: 'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.read`';
    };
    post: {
      summary: 'Create a company benefit';
      tags: ['Benefits'];
      responses: {
        '201': {
          $ref: '#/components/responses/Company-Benefit-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-company_benefits';
      description: 'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                benefit_id: {
                  type: 'number';
                  description: 'The ID of the benefit to which the company benefit belongs.';
                };
                active: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether this benefit is active for employee participation.';
                };
                description: {
                  type: 'string';
                  description: 'The description of the company benefit.For example, a company may offer multiple benefits with an ID of 1 (for Medical Insurance). The description would show something more specific like “Kaiser Permanente” or “Blue Cross/ Blue Shield”.';
                };
                responsible_for_employer_taxes: {
                  type: 'boolean';
                  description: 'Whether the employer is subject to pay employer taxes when an employee is on leave. Only applicable to third party sick pay benefits.';
                };
                responsible_for_employee_w2: {
                  type: 'boolean';
                  description: 'Whether the employer is subject to file W-2 forms for an employee on leave. Only applicable to third party sick pay benefits.';
                };
              };
              required: ['benefit_id', 'description'];
            };
          };
        };
      };
    };
  };
  '/v1/company_benefits/{company_benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_benefit_id';
        in: 'path';
        required: true;
        description: 'The ID of the company benefit';
      },
    ];
    get: {
      summary: 'Get a company benefit';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-Object';
        };
      };
      operationId: 'get-v1-company_benefits-company_benefit_id';
      description: 'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.read`';
    };
    put: {
      summary: 'Update a company benefit';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-Object';
        };
      };
      operationId: 'put-v1-company_benefits-company_benefit_id';
      description: 'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits:write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                  readOnly: true;
                };
                active: {
                  type: 'boolean';
                  description: 'Whether this benefit is active for employee participation. Company benefits may only be deactivated if no employees are actively participating.';
                };
                description: {
                  type: 'string';
                  description: 'The description of the company benefit.For example, a company may offer multiple benefits with an ID of 1 (for Medical Insurance). The description would show something more specific like “Kaiser Permanente” or “Blue Cross/ Blue Shield”.';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                  active: false;
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/earning_types': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get all earning types for a company';
      tags: ['Earning Type'];
      responses: {
        '200': {
          $ref: '#/components/responses/Earning-Type-List';
        };
      };
      operationId: 'get-v1-companies-company_id-earning_types';
      description: 'A payroll item in Gusto is associated to an earning type to name the type of earning described by the payroll item.\n\n#### Default Earning Type\nCertain earning types are special because they have tax considerations. Those earning types are mostly the same for every company depending on its legal structure (LLC, Corporation, etc.)\n\n#### Custom Earning Type\nCustom earning types are all the other earning types added specifically for a company.\n\n`scope: payrolls.read`';
    };
    post: {
      summary: 'Create a custom earning type';
      tags: ['Earning Type'];
      responses: {
        '201': {
          $ref: '#/components/responses/Earning-Type-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-earning_types';
      description: 'Create a custom earning type.\n\nIf an inactive earning type exists with the same name, this will reactivate it instead of creating a new one.\n\n`scope: payrolls:write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  description: 'The name of the custom earning type.';
                };
              };
              required: ['name'];
            };
            examples: {
              Example: {
                value: {
                  name: 'Gym Membership Stipend';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/earning_types/{earning_type_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'earning_type_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the earning type';
      },
    ];
    put: {
      summary: 'Update an earning type';
      tags: ['Earning Type'];
      responses: {
        '200': {
          $ref: '#/components/responses/Earning-Type-Object';
        };
      };
      operationId: 'put-v1-companies-company_id-earning_types-earning_type_uuid';
      description: 'Update an earning type.\n\n`scope: payrolls.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  description: 'The name of the custom earning type.';
                };
              };
            };
            examples: {
              Example: {
                value: {
                  name: 'Gym Membership Stipend';
                };
              };
            };
          };
        };
      };
    };
    delete: {
      summary: 'Deactivate an earning type';
      tags: ['Earning Type'];
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      operationId: 'delete-v1-companies-company_id-earning_types-earning_type_uuid';
      description: 'Deactivate an earning type.\n\n`scope: payrolls.write`';
    };
  };
  '/v1/employees/{employee_id_or_uuid}/employee_benefits': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    get: {
      summary: "Get an employee's benefits";
      tags: ['Benefits'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-List';
        };
      };
      operationId: 'get-v1-employees-employee_id-employee_benefits';
      description: 'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\nReturns an array of all employee benefits for this employee\n\n`scope: employee_benefits.read`';
    };
    post: {
      summary: 'Create an employee benefit';
      tags: ['Benefits'];
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Benefit-Object';
        };
      };
      operationId: 'post-v1-employees-employee_id-employee_benefits';
      description: 'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                company_benefit_id: {
                  type: 'number';
                  description: 'The ID of the company to which the benefit belongs.';
                  readOnly: true;
                };
                active: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether the employee benefit is active.';
                };
                employee_deduction: {
                  type: 'string';
                  default: '0.00';
                  description: "The amount to be deducted, per pay period, from the employee's pay.";
                };
                deduct_as_percentage: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the employee deduction amount should be treated as a percentage to be deducted from each payroll.';
                };
                employee_deduction_annual_maximum: {
                  type: 'string';
                  description: 'The maximum employee deduction amount per year. A null value signifies no limit.';
                  nullable: true;
                };
                contribution: {
                  type: 'object';
                  description: 'An object representing the company contribution type and value.';
                  properties: {
                    type: {
                      type: 'string';
                      description: 'The company contribution scheme.\n\n`amount`: The company contributes a fixed amount per payroll. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`percentage`: The company contributes a percentage of the payroll amount per payroll period. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`tiered`: The size of the company contribution corresponds to the size of the employee deduction relative to a tiered matching scheme.';
                      enum: ['tiered', 'percentage', 'amount'];
                    };
                    value: {
                      description: 'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.\n\nFor the `tiered` contribution type, an array of tiers.';
                      oneOf: [
                        {
                          type: 'string';
                          description: 'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.';
                        },
                        {
                          type: 'array';
                          description: 'For `tiered` contribution types, an array of tiers.';
                          items: {
                            type: 'object';
                            description: 'A single tier of a tiered matching scheme.';
                            properties: {
                              rate: {
                                type: 'string';
                                description: 'The percentage of employee deduction within this tier the company contribution will match.';
                              };
                              threshold: {
                                type: 'string';
                                description: 'The percentage threshold at which this tier ends (inclusive).\n\nFor example, a value of "5" means the company contribution will match employee deductions from the previous tier\'s threshold up to and including 5% of payroll.\n\nIf this is the first tier, a value of "5" means the company contribution will match employee deductions from 0% up to and including 5% of payroll.';
                              };
                            };
                          };
                        },
                      ];
                    };
                  };
                };
                elective: {
                  type: 'boolean';
                  description: 'Whether the company contribution is elective (aka "matching"). For `tiered`, `elective_amount`, and `elective_percentage` contribution types this is ignored and assumed to be `true`.';
                  default: false;
                };
                company_contribution_annual_maximum: {
                  type: 'string';
                  description: 'The maximum company contribution amount per year. A null value signifies no limit.';
                  nullable: true;
                };
                limit_option: {
                  type: 'string';
                  description: 'Some benefits require additional information to determine their limit. For example, for an HSA benefit, the limit option should be either "Family" or "Individual". For a Dependent Care FSA benefit, the limit option should be either "Joint Filing or Single" or "Married and Filing Separately".';
                  nullable: true;
                };
                catch_up: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the employee should use a benefit’s "catch up" rate. Only Roth 401k and 401k benefits use this value for employees over 50.';
                };
                coverage_amount: {
                  type: 'string';
                  description: 'The amount that the employee is insured for. Note: company contribution cannot be present if coverage amount is set.';
                  nullable: true;
                };
                coverage_salary_multiplier: {
                  type: 'string';
                  default: '0.00';
                  description: 'The coverage amount as a multiple of the employee’s salary. Only applicable for Group Term Life benefits. Note: cannot be set if coverage amount is also set.';
                };
                deduction_reduces_taxable_income: {
                  type: 'string';
                  enum: ['unset', 'reduces_taxable_income', 'does_not_reduce_taxable_income', null];
                  description: 'Whether the employee deduction reduces taxable income or not. Only valid for Group Term Life benefits. Note: when the value is not "unset", coverage amount and coverage salary multiplier are ignored.';
                  nullable: true;
                };
                company_contribution: {
                  type: 'string';
                  default: '0.00';
                  description: 'The amount to be paid, per pay period, by the company.';
                  deprecated: true;
                };
                contribute_as_percentage: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the company contribution amount should be treated as a percentage to be deducted from each payroll.';
                  deprecated: true;
                };
              };
              required: ['company_benefit_id'];
            };
            examples: {
              Example: {
                value: {
                  company_benefit_id: 290384923980230;
                  active: true;
                  employee_deduction: '100.00';
                  contribution: {
                    type: 'amount';
                    value: '100.00';
                  };
                };
              };
            };
          };
        };
        description: '';
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/ytd_benefit_amounts_from_different_company': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    post: {
      summary: 'Year-to-date Benefit Amounts from Different Company';
      tags: ['Benefits'];
      operationId: 'post-employee-ytd-benefit-amounts-from-different-company';
      description: 'Year-to-date benefit amounts from a different company represents the amount of money added to an employees plan during a current year, made outside of the current contribution when they were employed at a different company.\n\n`scope: employee_benefits.write`';
      requestBody: {
        $ref: '#/components/requestBodies/post-employee-ytd-benefit-amounts-from-different-company';
      };
      responses: {
        '204': {
          description: 'No Content';
        };
      };
    };
  };
  '/v1/employee_benefits/{employee_benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_benefit_id';
        in: 'path';
        required: true;
        description: 'The ID of the employee benefit';
      },
    ];
    get: {
      summary: 'Get an employee benefit';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-Object';
        };
      };
      operationId: 'get-v1-employee_benefits-employee_benefit_id';
      description: 'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.read`';
    };
    put: {
      summary: 'Update an employee benefit';
      tags: ['Benefits'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-Object';
        };
      };
      operationId: 'put-v1-employee_benefits-employee_benefit_id';
      description: 'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                  readOnly: true;
                };
                active: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether the employee benefit is active.';
                };
                employee_deduction: {
                  type: 'string';
                  default: '0.00';
                  description: "The amount to be deducted, per pay period, from the employee's pay.";
                };
                deduct_as_percentage: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the employee deduction amount should be treated as a percentage to be deducted from each payroll.';
                };
                employee_deduction_annual_maximum: {
                  type: 'string';
                  description: 'The maximum employee deduction amount per year. A null value signifies no limit.';
                  nullable: true;
                };
                contribution: {
                  type: 'object';
                  description: 'An object representing the type and value of the company contribution.';
                  properties: {
                    type: {
                      type: 'string';
                      description: 'The company contribution scheme.\n\n`amount`: The company contributes a fixed amount per payroll. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`percentage`: The company contributes a percentage of the payroll amount per payroll period. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`tiered`: The size of the company contribution corresponds to the size of the employee deduction relative to a tiered matching scheme.';
                      enum: ['amount', 'percentage', 'tiered'];
                    };
                    value: {
                      description: 'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.\n\nFor the `tiered` contribution type, an array of tiers.';
                      oneOf: [
                        {
                          type: 'string';
                          description: 'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.';
                        },
                        {
                          type: 'array';
                          description: 'For `tiered` contribution types, an array of tiers.';
                          items: {
                            type: 'object';
                            description: 'A single tier of a tiered matching scheme.';
                            properties: {
                              rate: {
                                type: 'string';
                                description: 'The percentage of employee deduction within this tier the company contribution will match.';
                              };
                              threshold: {
                                type: 'string';
                                description: 'The percentage threshold at which this tier ends (inclusive).\n\nFor example, a value of "5" means the company contribution will match employee deductions from the previous tier\'s threshold up to and including 5% of payroll.\n\nIf this is the first tier, a value of "5" means the company contribution will match employee deductions from 0% up to and including 5% of payroll.';
                              };
                            };
                          };
                        },
                      ];
                    };
                  };
                };
                elective: {
                  type: 'boolean';
                  description: 'Whether the company contribution is elective (aka "matching"). For `tiered`, `elective_amount`, and `elective_percentage` contribution types this is ignored and assumed to be `true`.';
                  default: false;
                };
                company_contribution_annual_maximum: {
                  type: 'string';
                  description: 'The maximum company contribution amount per year. A null value signifies no limit.';
                  nullable: true;
                };
                limit_option: {
                  type: 'string';
                  description: 'Some benefits require additional information to determine their limit. For example, for an HSA benefit, the limit option should be either "Family" or "Individual". For a Dependent Care FSA benefit, the limit option should be either "Joint Filing or Single" or "Married and Filing Separately".';
                  nullable: true;
                };
                catch_up: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the employee should use a benefit’s "catch up" rate. Only Roth 401k and 401k benefits use this value for employees over 50.';
                };
                coverage_amount: {
                  type: 'string';
                  description: 'The amount that the employee is insured for. Note: company contribution cannot be present if coverage amount is set.';
                  nullable: true;
                };
                deduction_reduces_taxable_income: {
                  type: 'string';
                  default: 'unset';
                  enum: ['unset', 'reduces_taxable_income', 'does_not_reduce_taxable_income', null];
                  description: 'Whether the employee deduction reduces taxable income or not. Only valid for Group Term Life benefits. Note: when the value is not "unset", coverage amount and coverage salary multiplier are ignored.';
                  nullable: true;
                };
                coverage_salary_multiplier: {
                  type: 'string';
                  default: '0.00';
                  description: 'The coverage amount as a multiple of the employee’s salary. Only applicable for Group Term Life benefits. Note: cannot be set if coverage amount is also set.';
                };
                company_contribution: {
                  type: 'string';
                  default: '0.00';
                  description: 'The amount to be paid, per pay period, by the company.';
                  deprecated: true;
                };
                contribute_as_percentage: {
                  type: 'boolean';
                  default: false;
                  description: 'Whether the company contribution amount should be treated as a percentage to be deducted from each payroll.';
                  deprecated: true;
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '09j3d29jqdpj92109j9j2d90dq';
                  employee_deduction: '250.00';
                };
              };
            };
          };
        };
      };
    };
    delete: {
      summary: 'Delete an employee benefit';
      tags: ['Benefits'];
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      operationId: 'delete-v1-employee_benefits-employee_benefit_id';
      description: 'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`';
    };
  };
  '/v1/companies/{company_id_or_uuid}/pay_periods': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get pay periods for a company';
      tags: ['Payrolls'];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/Pay-Period';
                };
              };
              examples: {
                Example: {
                  value: [
                    {
                      start_date: '2020-12-12';
                      end_date: '2020-12-25';
                      pay_schedule_id: 1409756036510222;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                      eligible_employees: [
                        {
                          id: 1409722316858016;
                          job_ids: [1409722316881160];
                        },
                        {
                          id: 7740244452464965;
                          job_ids: [7740244454306064];
                        },
                        {
                          id: 7757869431131641;
                          job_ids: [7757869439389315];
                        },
                      ];
                      payroll: {
                        processed: true;
                        payroll_deadline: '2020-12-28';
                      };
                    },
                    {
                      start_date: '2020-12-26';
                      end_date: '2021-01-08';
                      pay_schedule_id: 1409756036510222;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                      eligible_employees: [
                        {
                          id: 1409722316858016;
                          job_ids: [1409722316881160];
                        },
                        {
                          id: 7740244452464965;
                          job_ids: [7740244454306064];
                        },
                        {
                          id: 7757869431131641;
                          job_ids: [7757869439389315];
                        },
                      ];
                      payroll: {
                        processed: true;
                        payroll_deadline: '2021-01-12';
                      };
                    },
                    {
                      start_date: '2021-01-09';
                      end_date: '2021-01-22';
                      pay_schedule_id: 1409756036510222;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                      eligible_employees: [
                        {
                          id: 1409722316858016;
                          job_ids: [1409722316881160];
                        },
                        {
                          id: 7740244452464965;
                          job_ids: [7740244454306064];
                        },
                      ];
                      payroll: {
                        processed: true;
                        payroll_deadline: '2021-01-26';
                      };
                    },
                    {
                      start_date: '2021-01-23';
                      end_date: '2021-02-05';
                      pay_schedule_id: 1409756036510222;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                      eligible_employees: [
                        {
                          id: 1409722316858016;
                          job_ids: [1409722316881160];
                        },
                        {
                          id: 7740244452464965;
                          job_ids: [7740244454306064];
                        },
                      ];
                      payroll: {
                        processed: false;
                        payroll_deadline: '2021-02-09';
                      };
                    },
                    {
                      start_date: '2021-02-06';
                      end_date: '2021-02-19';
                      pay_schedule_id: 1409756036510222;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                      eligible_employees: [
                        {
                          id: 1409722316858016;
                          job_ids: [1409722316881160];
                        },
                        {
                          id: 7740244452464965;
                          job_ids: [7740244454306064];
                        },
                      ];
                      payroll: {
                        processed: false;
                        payroll_deadline: '2021-02-23';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
      operationId: 'get-v1-companies-company_id-pay_periods';
      description: 'Pay periods are the foundation of payroll. Compensation, time & attendance, taxes, and expense reports all rely on when they happened. To begin submitting information for a given payroll, we need to agree on the time period.\n\n\nBy default, this endpoint returns every current and past pay period for a company. Since companies can process payroll as often as every week, there can be up to 53 pay periods a year. If a company has been running payroll with Gusto for five years, this endpoint could return up to 265 pay periods. Use the `start_date` and `end_date` parameters to reduce the scope of the response.\n\n`scope: payrolls.read`';
      parameters: [
        {
          schema: {
            type: 'string';
            example: '2020-01-01';
          };
          in: 'query';
          name: 'start_date';
        },
        {
          schema: {
            type: 'string';
            example: '2020-01-31';
          };
          in: 'query';
          name: 'end_date';
        },
      ];
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the company';
        required: true;
      },
    ];
    get: {
      summary: 'Get all payrolls for a company';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-List';
        };
      };
      operationId: 'get-v1-companies-company_id-payrolls';
      description: 'Returns all payrolls, current and past for a company.\n\nNotes:\n* Hour and dollar amounts are returned as string representations of numeric decimals.\n* Hours are represented to the thousands place; dollar amounts are represented to the cent.\n* Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n\n`scope: payrolls.read`';
      parameters: [
        {
          schema: {
            type: 'boolean';
          };
          in: 'query';
          name: 'processed';
          description: 'Whether to return processed or unprocessed payrolls';
        },
        {
          schema: {
            type: 'boolean';
          };
          in: 'query';
          name: 'include_off_cycle';
          description: 'Whether to include off cycle payrolls in the response';
        },
        {
          schema: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['benefits', 'deductions', 'taxes'];
            };
          };
          in: 'query';
          name: 'include';
          description: 'Include the requested attribute in the employee_compensations attribute in the response';
        },
        {
          schema: {
            type: 'string';
          };
          in: 'query';
          name: 'start_date';
          description: 'Return payrolls whose pay period is after the start date';
        },
        {
          schema: {
            type: 'string';
          };
          in: 'query';
          name: 'end_date';
          description: 'Return payrolls whose pay period is before the end date';
        },
      ];
    };
    post: {
      summary: 'Create an Off-Cycle Payroll';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object';
        };
      };
      operationId: 'post-v1-companies-company_id-payrolls';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates a new, unprocessed, off-cycle payroll.';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                off_cycle: {
                  type: 'string';
                };
                off_cycle_reason: {
                  type: 'string';
                  enum: ['Bonus', 'Correction'];
                };
                start_date: {
                  type: 'string';
                };
                end_date: {
                  type: 'string';
                };
                employee_ids: {
                  type: 'array';
                  items: {
                    type: 'integer';
                  };
                };
                check_date: {
                  type: 'string';
                };
              };
              required: ['off_cycle'];
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'payroll_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the payroll ';
      },
    ];
    put: {
      summary: 'Update a payroll by ID';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object';
        };
      };
      operationId: 'put-v1-companies-company_id-payrolls';
      description: 'This endpoint allows you to update information for one or more employees for a specific **unprocessed** payroll.\n\n`scope: payrolls.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
                };
                employee_compensations: {
                  type: 'array';
                  items: {
                    type: 'object';
                    description: '';
                    properties: {
                      employee_id: {
                        type: 'integer';
                        description: 'The ID of the employee. Required unless using employee_uuid.';
                      };
                      employee_uuid: {
                        type: 'string';
                        description: 'The UUID of the employee. Required unless using employee_id.';
                      };
                      excluded: {
                        type: 'boolean';
                        description: 'This employee will be excluded from payroll calculation and will not be paid for the payroll.';
                      };
                      fixed_compensations: {
                        type: 'array';
                        items: {
                          type: 'object';
                          description: 'An array of fixed compensations for the employee. Fixed compensations include tips, bonuses, and one time reimbursements.';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.';
                            };
                            amount: {
                              type: 'string';
                              description: 'The amount of the compensation for the pay period.';
                            };
                            job_id: {
                              type: 'integer';
                              description: 'The ID of the job for the compensation.';
                            };
                          };
                        };
                      };
                      hourly_compensations: {
                        type: 'array';
                        items: {
                          type: 'object';
                          description: 'An array of hourly compensations for the employee. Hourly compensations include regular, overtime, and double overtime hours.';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.';
                            };
                            hours: {
                              type: 'string';
                              description: 'The number of hours to be compensated for this pay period.';
                            };
                            job_id: {
                              type: 'integer';
                              description: 'The ID of the job for the compensation.';
                            };
                          };
                        };
                      };
                      paid_time_off: {
                        type: 'array';
                        description: 'An array of all paid time off the employee is eligible for this pay period.';
                        items: {
                          type: 'object';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the PTO. This also serves as the unique, immutable identifier for the PTO.';
                            };
                            hours: {
                              type: 'string';
                              description: 'The hours of this PTO taken during the pay period.';
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
              required: ['version', 'employee_compensations'];
            };
            examples: {
              Example: {
                value: {
                  version: '19289df18e6e20f797de4a585ea5a91535c7ddf7';
                  employee_compensations: [
                    {
                      employee_id: 1123581321345589;
                      excluded: false;
                      fixed_compensations: [
                        {
                          name: 'Bonus';
                          amount: '200.00';
                          job_id: 1;
                        },
                      ];
                      hourly_compensations: [
                        {
                          name: 'Regular Hours';
                          hours: '30.000';
                          job_id: 1;
                        },
                        {
                          name: 'Double Overtime';
                          hours: '20.000';
                          job_id: 1;
                        },
                        {
                          name: 'Overtime';
                          hours: '10.000';
                          job_id: 2;
                        },
                      ];
                      paid_time_off: [
                        {
                          name: 'Vacation Hours';
                          hours: '25.000';
                        },
                        {
                          name: 'Sick Hours';
                          hours: '10.000';
                        },
                        {
                          name: 'Holiday Hours';
                          hours: '8.000';
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    get: {
      summary: 'Get a single payroll';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object';
        };
      };
      operationId: 'get-v1-companies-company_id-payrolls-payroll_id';
      description: 'Returns a payroll.\n\nNotes:\n* Hour and dollar amounts are returned as string representations of numeric decimals.\n* Hours are represented to the thousands place; dollar amounts are represented to the cent.\n* Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n\n`scope: payrolls.read`';
      parameters: [
        {
          schema: {
            type: 'string';
            enum: ['benefits', 'deductions', 'taxes'];
          };
          in: 'query';
          name: 'include';
          description: 'Include the requested attribute in the employee_compensations attribute in the response';
        },
        {
          schema: {
            type: 'string';
          };
          in: 'query';
          name: 'show_calculation';
          description: 'with `include`, shows the tax, and/or benefit, and/or deduction details for a calculated, unprocessed payroll. ';
        },
      ];
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls/{pay_period_start_date}/{pay_period_end_date}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'pay_period_start_date';
        in: 'path';
        required: true;
        description: 'The start_date of the pay period for the payroll';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'pay_period_end_date';
        in: 'path';
        required: true;
        description: 'The end_date of the pay period for the payroll';
      },
    ];
    put: {
      summary: 'Update a payroll';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object';
        };
      };
      operationId: 'put-v1-companies-company_id-payrolls-pay_period_start_date-pay_period_end_date';
      description: 'This endpoint allows you to update information for one or more employees for a specific **unprocessed** payroll.\n\nThe payrolls are identified by their pay periods’ start_date and end_date. Both are required and must correspond with an existing, unprocessed payroll. *If the dates do not match, the entire request will be rejected.* This was an explicit design decision to remove any assumptions around the timespan for data sent.\n\n`scope: payrolls.write`';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
                };
                employee_compensations: {
                  type: 'array';
                  items: {
                    type: 'object';
                    description: '';
                    properties: {
                      employee_id: {
                        type: 'integer';
                        description: 'The ID of the employee. Required unless using employee_uuid.';
                      };
                      employee_uuid: {
                        type: 'string';
                        description: 'The UUID of the employee. Required unless using employee_id.';
                      };
                      excluded: {
                        type: 'boolean';
                        description: 'This employee will be excluded from payroll calculation and will not be paid for the payroll.';
                      };
                      fixed_compensations: {
                        type: 'array';
                        items: {
                          type: 'object';
                          description: 'An array of fixed compensations for the employee. Fixed compensations include tips, bonuses, and one time reimbursements.';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.';
                            };
                            amount: {
                              type: 'string';
                              description: 'The amount of the compensation for the pay period.';
                            };
                            job_id: {
                              type: 'integer';
                              description: 'The ID of the job for the compensation.';
                            };
                          };
                        };
                      };
                      hourly_compensations: {
                        type: 'array';
                        items: {
                          type: 'object';
                          description: 'An array of hourly compensations for the employee. Hourly compensations include regular, overtime, and double overtime hours.';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.';
                            };
                            hours: {
                              type: 'string';
                              description: 'The number of hours to be compensated for this pay period.';
                            };
                            job_id: {
                              type: 'integer';
                              description: 'The ID of the job for the compensation.';
                            };
                          };
                        };
                      };
                      paid_time_off: {
                        type: 'array';
                        description: 'An array of all paid time off the employee is eligible for this pay period.';
                        items: {
                          type: 'object';
                          properties: {
                            name: {
                              type: 'string';
                              description: 'The name of the PTO. This also serves as the unique, immutable identifier for the PTO.';
                            };
                            hours: {
                              type: 'string';
                              description: 'The hours of this PTO taken during the pay period.';
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
              required: ['version', 'employee_compensations'];
            };
            examples: {
              Example: {
                value: {
                  version: '19289df18e6e20f797de4a585ea5a91535c7ddf7';
                  employee_compensations: [
                    {
                      employee_id: 1123581321345589;
                      excluded: false;
                      fixed_compensations: [
                        {
                          name: 'Bonus';
                          amount: '200.00';
                          job_id: 1;
                        },
                      ];
                      hourly_compensations: [
                        {
                          name: 'Regular Hours';
                          hours: '30.000';
                          job_id: 1;
                        },
                        {
                          name: 'Double overtime';
                          hours: '20.000';
                          job_id: 1;
                        },
                        {
                          name: 'Overtime';
                          hours: '10.000';
                          job_id: 2;
                        },
                      ];
                      paid_time_off: [
                        {
                          name: 'Vacation Hours';
                          hours: '25.000';
                        },
                        {
                          name: 'Sick Hours';
                          hours: '10.000';
                        },
                        {
                          name: 'Holiday Hours';
                          hours: '8.000';
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/partner_managed_companies': {
    post: {
      summary: 'Create a partner managed company';
      tags: ['Companies'];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                description: '';
                type: 'object';
                properties: {
                  access_token: {
                    type: 'string';
                    description: 'Access token that can be used for OAuth access to the account. Access tokens expire 2 hours after they are issued.';
                    readOnly: true;
                  };
                  refresh_token: {
                    type: 'string';
                    description: 'Refresh token that can be exchanged for a new access token.';
                    readOnly: true;
                  };
                  company_uuid: {
                    type: 'string';
                    description: 'Gusto’s UUID for the company';
                    readOnly: true;
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    access_token: 'de6780bc506a0446309bd9362820ba8aed28aa506c71eedbe1c5c4f9dd350e54';
                    refresh_token: '8257e65c97202ed1726cf9571600918f3bffb2544b26e00a61df9897668c33a1';
                    company_uuid: 'd525dd21-ba6e-482c-be15-c2c7237f1364';
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'post-v1-partner-managed-companies';
      description: 'This endpoint is intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\n### Overview\n\nThe partner managed company API provides a way to create a Gusto company that you can manage. This endpoint behaves similarly to [creating a company](../~1v1~1provision/post) in that it does the following:\n\n* Creates a new company in Gusto.\n* Creates a new user in Gusto.\n* Makes the new user the primary payroll administrator of the new company.\n\nAdditionally, on successful creation of the company, this API will do the following:\n* Creates a link between the partner and the company.\n* Creates access tokens and refresh tokens that can be used immediately.\n\nIn the response, you will receive the access token, the refresh token, and the uuid of the created company.\n\n### Authentication\n\nDue to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n\n```\nContent-Type: application/json\nAuthorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n```';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                user: {
                  type: 'object';
                  description: 'Information for the user who will be the primary payroll administrator for the new company.';
                  required: ['first_name', 'last_name', 'email'];
                  properties: {
                    first_name: {
                      type: 'string';
                      description: 'The first name of the user who will be the primary payroll admin.';
                    };
                    last_name: {
                      type: 'string';
                      description: 'The last name of the user who will be the primary payroll admin.';
                    };
                    email: {
                      type: 'string';
                      description: 'The email of the user who will be the primary payroll admin.';
                    };
                    phone: {
                      type: 'string';
                      description: 'The phone number of the user who will be the primary payroll admin.';
                    };
                  };
                };
                company: {
                  type: 'object';
                  required: ['name'];
                  properties: {
                    name: {
                      type: 'string';
                      description: 'The legal name of the company.';
                    };
                    trade_name: {
                      type: 'string';
                      description: 'The name of the company.';
                    };
                    ein: {
                      type: 'string';
                      description: 'The employer identification number (EIN) of the company.';
                    };
                  };
                };
              };
              required: ['user', 'company'];
            };
            examples: {
              Example: {
                value: {
                  user: {
                    first_name: 'Frank';
                    last_name: 'Ocean';
                    email: 'frank@example.com';
                    phone: '2345558899';
                  };
                  company: {
                    name: "Frank's Ocean, LLC";
                    trade_name: 'Frank’s Ocean';
                    ein: '123456789';
                  };
                };
              };
            };
          };
        };
        description: '';
      };
      security: [];
    };
  };
  '/v1/provision': {
    post: {
      summary: 'Create a company';
      tags: ['Companies'];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                description: '';
                type: 'object';
                properties: {
                  account_claim_url: {
                    type: 'string';
                    description: 'A URL where the user should be redirected to complete their account setup inside of Gusto.';
                    readOnly: true;
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    account_claim_url: 'https://app.gusto.com/claim_account/3456789';
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'post-v1-provision';
      description: '### Overview\n\nThe company provisioning API provides a way to create a Gusto company as part of your integration. When you successfully call the API, the API does the following:\n\n* Creates a new company in Gusto.\n* Creates a new user in Gusto.\n* Makes the new user the primary payroll administrator of the new company.\n* Sends a welcome email to the new user.\n\nIn the response, you will receive an account claim URL. Redirect the user to this URL to complete their account setup inside of Gusto\n\n### Authentication\n\nDue to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n\n```\nContent-Type: application/json\nAuthorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n```';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                user: {
                  type: 'object';
                  description: 'Information for the user who will be the primary payroll administrator for the new company.';
                  required: ['first_name', 'last_name', 'email'];
                  properties: {
                    first_name: {
                      type: 'string';
                      description: 'The first name of the user who will be the primary payroll admin.';
                    };
                    last_name: {
                      type: 'string';
                      description: 'The last name of the user who will be the primary payroll admin.';
                    };
                    email: {
                      type: 'string';
                      description: 'The email of the user who will be the primary payroll admin.';
                    };
                    phone: {
                      type: 'string';
                      description: 'The phone number of the user who will be the primary payroll admin.';
                    };
                  };
                };
                company: {
                  type: 'object';
                  required: ['name'];
                  properties: {
                    name: {
                      type: 'string';
                      description: 'The legal name of the company.';
                    };
                    trade_name: {
                      type: 'string';
                      description: 'The name of the company.';
                    };
                    ein: {
                      type: 'string';
                      description: 'The employer identification number (EIN) of the company.';
                    };
                    states: {
                      type: 'array';
                      description: 'The states in which the company operates. States should be included by their two letter code, i.e. NY for New York. ';
                      items: {
                        type: 'string';
                      };
                    };
                    number_employees: {
                      type: 'number';
                      description: 'The number of employees in the company.';
                    };
                    addresses: {
                      type: 'array';
                      uniqueItems: false;
                      description: 'The locations for the company. This includes mailing, work, and filing addresses.';
                      items: {
                        type: 'object';
                        properties: {
                          street_1: {
                            type: 'string';
                          };
                          street_2: {
                            type: 'string';
                            nullable: true;
                          };
                          city: {
                            type: 'string';
                          };
                          zip: {
                            type: 'string';
                          };
                          state: {
                            type: 'string';
                          };
                          phone: {
                            type: 'string';
                          };
                          is_primary: {
                            type: 'string';
                            description: 'Whether or not this is a primary address for the company. If set to true, the address will be used as the mailing and filing address for the company and will be added as a work location. If set to false or not included, the address will only be added as a work location for the company. If multiple addresses are included, only one should be marked as primary.';
                          };
                        };
                      };
                    };
                  };
                };
              };
              required: ['user', 'company'];
            };
            examples: {
              Example: {
                value: {
                  user: {
                    first_name: 'Frank';
                    last_name: 'Ocean';
                    email: 'frank@example.com';
                    phone: '2345558899';
                  };
                  company: {
                    name: "Frank's Ocean, LLC";
                    trade_name: 'Frank’s Ocean';
                    tier: 'complete';
                    ein: '123456789';
                    states: ['CO', 'CA'];
                    number_employees: 8;
                    addresses: [
                      {
                        street_1: '1201 16th Street Mall';
                        street_2: 'Suite 350';
                        city: 'Denver';
                        zip: '80202';
                        state: 'CO';
                        phone: '2345678900';
                        is_primary: 'true';
                      },
                      {
                        street_1: '525 20th Street';
                        city: 'San Francisco';
                        zip: '94107';
                        state: 'CA';
                        phone: '2345678901';
                      },
                    ];
                  };
                };
              };
            };
          };
        };
        description: '';
      };
      security: [];
    };
  };
  '/v1/employees/{employee_id_or_uuid}/custom_fields': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the employee';
      },
    ];
    get: {
      summary: "Get an employee's custom fields";
      tags: ['Custom Fields'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  custom_fields: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/Employee-Custom-Field';
                    };
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    custom_fields: [
                      {
                        id: 'ee515986-f3ca-49da-b576-2691b95262f9';
                        company_custom_field_id: 'ea7e5d57-6abb-47d7-b654-347c142886c0';
                        name: 'employee_level';
                        description: 'Employee Level';
                        type: 'text';
                        value: '2';
                        selection_options: null;
                      },
                      {
                        id: '3796e08d-c2e3-434c-b4de-4ce1893e7b59';
                        company_custom_field_id: '299650e4-e970-4acf-9bf0-6f05585d20ba';
                        name: 't-shirt size';
                        description: 'What is your t-shirt size?';
                        type: 'text';
                        value: 'md';
                        selection_options: null;
                      },
                      {
                        id: '3796e08d-c2e3-434c-b4de-4ce1893e7b59';
                        company_custom_field_id: '024ec137-6c92-43a3-b061-14a9720531d6';
                        name: 'favorite fruit';
                        description: 'Which is your favorite fruit?';
                        type: 'radio';
                        value: 'apple';
                        selection_options: ['apple', 'banana', 'orange'];
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'get-v1-employees-employee_id-custom_fields';
      description: "Returns a list of the employee's custom fields.\n\n`scope: employees.read`";
    };
  };
  '/v1/companies/{company_id_or_uuid}/custom_fields': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the company';
      },
    ];
    get: {
      summary: 'Get the custom fields of a company';
      description: 'Returns a list of the custom fields of the company. Useful when you need to know the schema of custom fields for an entire company\n\n`scope: companies.read`';
      operationId: 'get-v1-companies-company_id-custom_fields';
      tags: ['Custom Fields'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  custom_fields: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/Company-Custom-Field';
                    };
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    custom_fields: [
                      {
                        id: 'ea7e5d57-6abb-47d7-b654-347c142886c0';
                        name: 'employee_level';
                        description: 'Employee Level';
                        type: 'text';
                        selection_options: null;
                      },
                      {
                        id: '299650e4-e970-4acf-9bf0-6f05585d20ba';
                        name: 't-shirt size';
                        description: 'What is your t-shirt size?';
                        type: 'text';
                        selection_options: null;
                      },
                      {
                        id: '024ec137-6c92-43a3-b061-14a9720531d6';
                        name: 'favorite fruit';
                        description: 'Which is your favorite fruit?';
                        type: 'radio';
                        selection_options: ['apple', 'banana', 'orange'];
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/time_off_requests/{time_off_request_id}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID or ID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'time_off_request_id';
        in: 'path';
        required: true;
        description: 'The ID or UUID of the time off request';
      },
    ];
    get: {
      summary: 'Get a specific time off request';
      tags: ['Time Off Requests'];
      responses: {
        '200': {
          $ref: '#/components/responses/Time-Off-Request-Object';
        };
      };
      operationId: 'get-v1-companies-company_id-time_off_requests-time_off_request_id';
      description: 'Details of a single time off request\n\n`scope: time_off_requests.read`';
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/calculate': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'payroll_id_or_uuid';
        in: 'path';
        required: true;
      },
    ];
    put: {
      summary: 'Calculate a Payroll';
      tags: ['Payrolls'];
      responses: {
        '202': {
          description: 'Accepted';
        };
      };
      operationId: 'put-v1-companies-company_id-payrolls-payroll_id-calculate';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nPerforms calculations for taxes, benefits, and deductions for an unprocessed payroll. The calculated payroll details provide a preview of the actual values that will be used when the payroll is run.\n\nThis calculation is asynchronous and a sucessful request responds with a 202 HTTP status. To view the details of the calculated payroll, use the GET /v1/companies/{company_id}/payrolls/{payroll_id} endpoint with the *show_calculation=true* and *include=taxes,benefits,deductions* params.\n\nIf the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n\n```\n{ "errors": { "missing_requirements": ["needs_onboarding", "invalid_signatory"] } }\n```';
      parameters: [];
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/submit': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'Company ID or UUID';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'payroll_id_or_uuid';
        in: 'path';
        required: true;
        description: 'Payroll ID or UUID';
      },
    ];
    put: {
      summary: 'Submit Payroll';
      tags: ['Payrolls'];
      responses: {
        '202': {
          description: 'Accepted';
        };
      };
      operationId: 'put-v1-companies-company_id-payrolls-payroll_id-submit';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSubmits an unprocessed payroll to be calculated and run. This submission is asynchronous and a sucessful request responds with a 202 HTTP status. Upon success, transitions the payroll to the `processed` state.\n\nIf the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n\n```\n{ "errors": { "missing_requirements": ["needs_onboarding", "invalid_signatory"] } }\n```';
    };
  };
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/cancel': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'Company ID or UUID';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'payroll_id_or_uuid';
        in: 'path';
        required: true;
        description: 'Payroll ID or UUID';
      },
    ];
    put: {
      summary: 'Cancel a Payroll';
      tags: ['Payrolls'];
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object';
        };
      };
      operationId: 'put-api-v1-companies-company_id-payrolls-payroll_id-cancel';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nTransitions a `processed` payroll back to the `unprocessed` state. A payroll cannot be canceled once it has entered the `funded` state.\n';
    };
  };
  '/v1/companies/{company_id_or_uuid}/payroll_reversals': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
      },
    ];
    get: {
      summary: 'Get approved Payroll Reversals';
      tags: ['Payrolls'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  reversed_payroll_id: {
                    type: 'integer';
                    description: 'The payroll run being reversed.';
                  };
                  reversal_payroll_id: {
                    type: 'integer';
                    description: 'The payroll where the reversal was applied.';
                  };
                  reason: {
                    type: 'string';
                    description: 'A reason provided by the admin who created the reversal.';
                  };
                  approved_at: {
                    type: 'string';
                    description: 'Timestamp of when the reversal was approved.';
                    nullable: true;
                  };
                  category: {
                    type: 'string';
                    description: 'Category chosen by the admin who requested the reversal.';
                  };
                  reversed_employee_ids: {
                    type: 'array';
                    description: 'Array of employee ids affected.';
                    items: {
                      type: 'integer';
                    };
                  };
                };
              };
              examples: {
                'Successful Response': {
                  value: {
                    reversed_payroll_id: 3;
                    reversal_payroll_id: 5;
                    reason: 'Customer Request';
                    approved_at: null;
                    category: 'convert_check_ee_requested';
                    reversed_employee_ids: [3];
                  };
                };
              };
            };
          };
        };
      };
      operationId: 'get-v1-companies-company_id_or_uuid-payroll_reversals';
      description: 'Returns all approved Payroll Reversals for a Company.\n\n`scope: payrolls.read`';
    };
  };
  '/v1/companies/{company_id_or_uuid}/admins': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The ID of the company';
      },
    ];
    get: {
      summary: 'Get all the admins at a company';
      tags: ['Admins'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      operationId: 'get-v1-companies-company_id-admins';
      responses: {
        '200': {
          $ref: '#/components/responses/Admin-List';
        };
      };
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns a list of all the admins at a company';
    };
    post: {
      summary: 'Create an admin for the company.';
      tags: ['Admins'];
      operationId: 'post-v1-companies-company_id-admins';
      responses: {
        '200': {
          $ref: '#/components/responses/Admin-Object';
        };
      };
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates a new admin for a company. If the email matches an existing user, this will create an admin account for the current user. Otherwise, this will create a new user.';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                first_name: {
                  type: 'string';
                  description: 'The first name of the admin.';
                };
                last_name: {
                  type: 'string';
                  description: 'The last name of the admin.';
                };
                email: {
                  type: 'string';
                  description: 'The email of the admin. This will be used for the admin to log in to their account. If the email matches an existing user, this will create an admin account for them.';
                };
              };
              required: ['first_name', 'last_name', 'email'];
            };
            examples: {
              Example: {
                value: {
                  first_name: 'John';
                  last_name: 'Smith';
                  email: 'jsmith99@gmail.com';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_id_or_uuid}/federal_tax_details': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The company id or uuid';
      },
    ];
    get: {
      summary: 'Get Federal Tax Details';
      responses: {
        '200': {
          $ref: '#/components/responses/Federal-Tax-Details-Object';
        };
      };
      operationId: 'get-v1-companies-company_id_or_uuid-federal_tax_details';
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nFetches attributes relevant for a company's federal taxes.";
      parameters: [];
      security: [
        {
          Authorization: [];
        },
      ];
      tags: ['Federal Tax Details'];
    };
    put: {
      summary: 'Update Federal Tax Details';
      responses: {
        '200': {
          $ref: '#/components/responses/Federal-Tax-Details-Object';
        };
      };
      operationId: 'put-v1-companies-company_id_or_uuid-federal_tax_details';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                legal_name: {
                  type: 'string';
                  description: 'The legal name of the company';
                };
                ein: {
                  type: 'string';
                  description: 'The EIN of of the company';
                };
                tax_payer_type: {
                  type: 'string';
                  description: 'What type of tax entity the company is';
                };
                filing_form: {
                  type: 'string';
                  description: 'The form used by the company for federal tax filing. One of:\n- 941 (Quarterly federal tax return)\n- 944 (Annual federal tax return)';
                };
                taxable_as_scorp: {
                  type: 'boolean';
                  description: 'Whether this company should be taxed as an S-Corporation';
                };
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
                };
              };
              required: ['version'];
            };
            examples: {
              Example: {
                value: {
                  version: '6cb95e00540706ca48d4577b3c839fbe';
                  tax_payer_type: 'LLP';
                  taxable_as_scorp: false;
                  filing_form: '944';
                  has_ein: true;
                  ein_verified: false;
                  legal_name: 'Acme Corp.';
                };
              };
            };
          };
        };
        description: 'Attributes related to federal tax details that can be updated via this endpoint include:';
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdates attributes relevant for a company's federal taxes. This information is required is to onboard a company for use with Gusto Embedded Payroll.";
      tags: ['Federal Tax Details'];
    };
  };
  '/v1/employees/{employee_id_or_uuid}/bank_accounts': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
      },
    ];
    get: {
      summary: 'Get all employee bank accounts';
      tags: ['Employee Bank Accounts'];
      parameters: [
        {
          $ref: '#/components/parameters/pageParam';
        },
        {
          $ref: '#/components/parameters/perParam';
        },
      ];
      operationId: 'get-v1-employees-employee_id-bank_accounts';
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns all employee bank accounts.';
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Bank-Account-List';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {};
            };
          };
        };
      };
    };
    post: {
      summary: 'Create an employee bank account';
      operationId: 'post-v1-employees-employee_id-bank_accounts';
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Bank-Account-Object';
        };
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates an employee bank account. An employee can have multiple bank accounts. Note that creating an employee bank account will also update the employee's payment method.";
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                };
                routing_number: {
                  type: 'string';
                };
                account_number: {
                  type: 'string';
                };
                account_type: {
                  type: 'string';
                  enum: ['Checking', 'Savings'];
                };
              };
              required: ['name', 'routing_number', 'account_number', 'account_type'];
            };
            examples: {
              Example: {
                value: {
                  name: 'BoA Checking Account';
                  routing_number: '266905059';
                  account_number: '5809431207';
                  account_type: 'Checking';
                };
              };
            };
          };
        };
      };
      tags: ['Employee Bank Accounts'];
    };
  };
  '/v1/employees/{employee_id_or_uuid}/bank_accounts/{bank_account_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'bank_account_uuid';
        in: 'path';
        required: true;
      },
    ];
    delete: {
      summary: 'Delete an employee bank account';
      operationId: 'delete-v1-employees-employee_id-bank_accounts-bank_account_id';
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nDeletes an employee bank account. To update an employee's bank account details, delete the bank account first and create a new one.";
      tags: ['Employee Bank Accounts'];
    };
  };
  '/v1/employees/{employee_id_or_uuid}/payment_method': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
      },
    ];
    get: {
      summary: "Get an employee's payment method";
      tags: ['Employee Payment Method'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Payment-Method-Object';
        };
      };
      operationId: 'get-v1-employees-employee_id-payment_method';
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nFetches an employee's payment method. An employee payment method describes how the payment should be split across the employee's associated bank accounts.";
    };
    put: {
      summary: "Update an employee's payment method";
      tags: ['Employee Payment Method'];
      operationId: 'put-v1-employees-employee_id-payment_method';
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Payment-Method-Object';
        };
      };
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdates an employee's payment method. Note that creating an employee bank account will also update the employee's payment method.";
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
                };
                type: {
                  type: 'string';
                  enum: ['Direct Deposit', 'Check'];
                  description: 'The payment method type. If type is Check, then split_by and splits do not need to be populated. If type is Direct Deposit, split_by and splits are required.';
                };
                split_by: {
                  type: 'string';
                  enum: ['Amount', 'Percentage'];
                  description: 'Describes how the payment will be split. If split_by is Percentage, then the split amounts must add up to exactly 100. If split_by is Amount, then the last split amount must be nil to capture the remainder.';
                };
                splits: {
                  type: 'array';
                  items: {
                    type: 'object';
                    properties: {
                      uuid: {
                        type: 'string';
                        description: 'The bank account ID\n';
                      };
                      name: {
                        type: 'string';
                        description: 'The bank account name';
                      };
                      priority: {
                        description: 'The order of priority for each payment split, with priority 1 being the first bank account paid. Priority must be unique and sequential.';
                        type: 'integer';
                      };
                      split_amount: {
                        description: 'The cents amount allocated for each payment split';
                        type: 'integer';
                        nullable: true;
                      };
                    };
                  };
                };
              };
              required: ['version', 'type'];
            };
            examples: {
              'example-1': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed';
                  type: 'Direct Deposit';
                  split_by: 'Amount';
                  splits: [
                    {
                      uuid: 'e88f9436-b74e-49a8-87e9-777b9bfe715e';
                      name: 'BoA Checking Account';
                      priority: 1;
                      split_amount: 500;
                    },
                    {
                      uuid: '0d2b7f73-05d6-4184-911d-269edeecc30a';
                      name: 'Chase Checking Account';
                      priority: 2;
                      split_amount: 1000;
                    },
                    {
                      uuid: '1531e824-8d9e-4bd8-9f90-0d04608125d7';
                      name: 'US Bank Checking Account';
                      priority: 3;
                      split_amount: null;
                    },
                  ];
                };
              };
              'example-2': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed';
                  type: 'Direct Deposit';
                  split_by: 'Percentage';
                  splits: [
                    {
                      uuid: 'e88f9436-b74e-49a8-87e9-777b9bfe715e';
                      name: 'BoA Checking Account';
                      priority: 1;
                      split_amount: 60;
                    },
                    {
                      uuid: '0d2b7f73-05d6-4184-911d-269edeecc30a';
                      name: 'Chase Checking Account';
                      priority: 2;
                      split_amount: 40;
                    },
                  ];
                };
              };
              'example-3': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed';
                  type: 'Check';
                };
              };
            };
          };
        };
        description: '';
      };
    };
  };
  '/v1/companies/{company_uuid}/signatories': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        description: 'The UUID of the company';
        required: true;
      },
    ];
    post: {
      summary: 'Create a signatory';
      tags: ['Signatories'];
      operationId: 'post-v1-company-signatories';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreate a company signatory with complete information. A signatory can legally sign forms once the identity verification process is successful.';
      responses: {
        '201': {
          $ref: '#/components/responses/Signatory-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              description: '';
              properties: {
                ssn: {
                  type: 'string';
                };
                first_name: {
                  type: 'string';
                };
                middle_initial: {
                  type: 'string';
                };
                last_name: {
                  type: 'string';
                };
                email: {
                  type: 'string';
                };
                title: {
                  type: 'string';
                };
                phone: {
                  type: 'string';
                };
                birthday: {
                  type: 'string';
                };
                home_address: {
                  type: 'object';
                  description: "The signatory's home address";
                  properties: {
                    street_1: {
                      type: 'string';
                    };
                    street_2: {
                      type: 'string';
                    };
                    city: {
                      type: 'string';
                    };
                    state: {
                      type: 'string';
                    };
                    zip: {
                      type: 'string';
                    };
                  };
                  required: ['street_1', 'city', 'state', 'zip'];
                };
              };
              required: ['ssn', 'first_name', 'last_name', 'email', 'title', 'birthday', 'home_address'];
            };
          };
        };
      };
    };
    get: {
      summary: 'Get all company signatories';
      responses: {
        '200': {
          $ref: '#/components/responses/Signatory-List';
        };
      };
      operationId: 'get-v1-companies-company_uuid-signatories';
      description: 'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns company signatories. Currently we only support a single signatory per company.';
      tags: ['Signatories'];
    };
  };
  '/v1/companies/{company_id_or_uuid}/forms': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the company';
        required: true;
      },
    ];
    get: {
      summary: 'Get all company forms';
      tags: ['Forms'];
      operationId: 'get-v1-company-forms';
      parameters: [];
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a list of all company's forms";
      responses: {
        '200': {
          $ref: '#/components/responses/Form-List';
        };
      };
    };
  };
  '/v1/forms/{id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    get: {
      summary: 'Get a company form';
      tags: ['Forms'];
      operationId: 'get-v1-company-form';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a company form';
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object';
        };
      };
    };
  };
  '/v1/forms/{id_or_uuid}/pdf': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    get: {
      summary: 'Get a form pdf';
      tags: ['Forms'];
      operationId: 'get-v1-company-form-pdf';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet the link to the form PDF';
      responses: {
        '200': {
          description: 'Example response';
          content: {
            'application/json': {
              schema: {
                title: 'Form PDF';
                type: 'object';
                properties: {
                  uuid: {
                    type: 'string';
                    description: 'the UUID of the form';
                    readOnly: true;
                  };
                  document_url: {
                    type: 'string';
                    description: 'the URL of the form';
                    readOnly: true;
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408';
                    document_url: 'https://app.gusto-demo.com/assets/forms/7757842065202782/original/company_direct_deposit20211007-48226-gsqo8k.pdf?1633667020';
                  };
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/forms/{id_or_uuid}/sign': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    put: {
      summary: 'Sign a company form';
      tags: ['Forms'];
      operationId: 'put-v1-company-form-sign';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSign a company form';
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                signature_text: {
                  type: 'string';
                  description: 'The signature';
                };
                agree: {
                  type: 'boolean';
                  description: 'whether you agree to sign electronically';
                };
                signed_by_ip_address: {
                  type: 'string';
                  description: 'The IP address of the signatory who signed the form.';
                };
              };
              required: ['signature_text', 'agree', 'signed_by_ip_address'];
            };
            examples: {
              Example: {
                value: {
                  signature_text: 'Jane Smith';
                  agree: true;
                  signed_by_ip_address: '192.168.0.1';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/forms': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the employee';
        required: true;
      },
    ];
    get: {
      summary: 'Get all employee forms';
      tags: ['Forms'];
      operationId: 'get-v1-employee-forms';
      parameters: [];
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a list of all employee's forms";
      responses: {
        '200': {
          $ref: '#/components/responses/Form-List';
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the employee';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    get: {
      summary: 'Get an employee form';
      tags: ['Forms'];
      operationId: 'get-v1-employee-form';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet an employee form';
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object';
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}/pdf': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the employee';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    get: {
      summary: "Get the PDF of an employee's form";
      tags: ['Forms'];
      operationId: 'get-v1-employee-form-pdf';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet the link to the form PDF';
      responses: {
        '200': {
          description: 'Example response';
          content: {
            'application/json': {
              schema: {
                title: 'Form PDF';
                type: 'object';
                properties: {
                  uuid: {
                    type: 'string';
                    description: 'the UUID of the form';
                    readOnly: true;
                  };
                  document_url: {
                    type: 'string';
                    description: 'the URL of the form';
                    readOnly: true;
                  };
                };
              };
              examples: {
                Example: {
                  value: {
                    uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408';
                    document_url: 'https://app.gusto-demo.com/assets/forms/7757842065202782/original/company_direct_deposit20211007-48226-gsqo8k.pdf?1633667020';
                  };
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}/sign': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the employee';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'id_or_uuid';
        in: 'path';
        description: 'The ID or UUID of the form';
        required: true;
      },
    ];
    put: {
      summary: 'Sign an employee form';
      tags: ['Forms'];
      operationId: 'put-v1-employee-form-sign';
      parameters: [];
      description: 'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSign a company form';
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '';
              type: 'object';
              properties: {
                signature_text: {
                  type: 'string';
                  description: 'The signature';
                };
                agree: {
                  type: 'boolean';
                  description: 'whether you agree to sign electronically';
                };
                signed_by_ip_address: {
                  type: 'string';
                  description: 'The IP address of the signatory who signed the form.';
                };
              };
              required: ['signature_text', 'agree', 'signed_by_ip_address'];
            };
            examples: {
              Example: {
                value: {
                  signature_text: 'Jane Smith';
                  agree: true;
                  signed_by_ip_address: '192.168.0.1';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/companies/{company_uuid}/flows': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        description: 'The UUID of the company';
        required: true;
      },
    ];
    post: {
      summary: 'Create a flow';
      tags: ['Flows'];
      operationId: 'post-v1-company-flows';
      parameters: [];
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGenerate a link to access a pre-built workflow in Gusto whitelabel UI. For security, all generated flows will expire within 1 hour of inactivity. Additionally, flows will be deactivated 24 hours from creation time. We currently support the following flow types\n|   |   |   |   |\n|---|---|---|---|\n|__flow_type__|__entity_type__|__entity_uuid__|__Flow description__|\n| **company_onboarding** | n/a | n/a | Full company onboarding flow |\n| **add_addresses** | n/a | n/a | Manage company's work, mailing, and filing addresses |\n| **federal_tax_setup** | n/a | n/a | Review and update company federal tax details |\n| **select_industry** | n/a | n/a | Select the company industry |\n| **add_bank_info** | n/a | n/a | Add bank info manually or via Plaid |\n| **verify_bank_info** | n/a | n/a | Bank deposits verification |\n| **add_employees** | n/a | n/a | Manage all employee onboarding |\n| **state_setup** | n/a | n/a | Review and update company state taxes |\n| **payroll_schedule** | n/a | n/a | Set company's payroll schedule |\n| **sign_all_forms** | n/a | n/a | Add signatory and sign company documents |\n| **employee_form_signing** | 'Employee' | employee's UUID | For employee to review and sign documents |";
      responses: {
        '201': {
          $ref: '#/components/responses/Flow-Object';
        };
      };
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                flow_type: {
                  type: 'string';
                  description: 'flow type';
                };
                entity_uuid: {
                  type: 'string';
                  description: 'UUID of the target entity applicable to the flow. This field is optional for company flows, please refer to the flow_types table above for more details.';
                };
                entity_type: {
                  type: 'string';
                  description: 'the type of target entity applicable to the flow. This field is optional for company flows, please refer to the flow_types table above for more details.';
                  enum: ['Company'];
                };
              };
              required: ['flow_type'];
            };
            examples: {
              Example: {
                value: {
                  flow_type: 'company_onboarding';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/payrolls/{payroll_id_or_uuid}/employees/{employee_id_or_uuid}/pay_stub': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'payroll_id_or_uuid';
        in: 'path';
        required: true;
      },
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
      },
    ];
    get: {
      summary: 'Get an employee pay stub (pdf)';
      tags: ['Payrolls'];
      operationId: 'get-v1-payrolls-payroll_uuid-employees-employee_uuid-pay_stub';
      description: "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet an employee's pay stub for the specified payroll. By default, an application/pdf response will be returned. No other content types are currently supported, but may be supported in the future.\n\nscope: `payrolls:run`";
      parameters: [];
      responses: {
        '200': {
          description: 'OK';
        };
      };
    };
  };
  '/v1/companies/{company_uuid}/signatories/invite': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        required: true;
      },
    ];
    post: {
      summary: 'Invite a signatory';
      responses: {
        '201': {
          $ref: '#/components/responses/Signatory-Object';
        };
      };
      operationId: 'post-v1-companies-company_uuid-signatories-invite';
      description: 'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreate a signatory with minimal information. This signatory can be invited to provide more information through the `PUT /v1/companies/{company_uuid}/signatories/{signatory_uuid}` endpoint. This will start the identity verification process and allow the signatory to be verified to sign documents.';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                first_name: {
                  type: 'string';
                };
                last_name: {
                  type: 'string';
                };
                title: {
                  type: 'string';
                };
                email: {
                  type: 'string';
                };
              };
              required: ['email'];
            };
          };
        };
      };
      tags: ['Signatories'];
    };
  };
  '/v1/companies/{company_uuid}/signatories/{signatory_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'company_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the company';
      },
      {
        schema: {
          type: 'string';
        };
        name: 'signatory_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the signatory';
      },
    ];
    put: {
      summary: 'Update a signatory';
      responses: {
        '200': {
          $ref: '#/components/responses/Signatory-Object';
        };
      };
      operationId: 'put-v1-companies-company_uuid-signatories-signatory_uuid';
      description: 'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate a signatory that has been either invited or created. If the signatory has been created with minimal information through the `POST /v1/companies/{company_uuid}/signatories/invite` endpoint, then the first update must contain all attributes specified in the request body in order to start the identity verification process.';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                version: {
                  type: 'string';
                  description: 'The current version of the object. See the versioning guide for information on how to use this field.';
                };
                first_name: {
                  type: 'string';
                };
                middle_initial: {
                  type: 'string';
                };
                last_name: {
                  type: 'string';
                };
                title: {
                  type: 'string';
                };
                phone: {
                  type: 'string';
                };
                birthday: {
                  type: 'string';
                };
                ssn: {
                  type: 'string';
                };
                home_address: {
                  type: 'object';
                  properties: {
                    street_1: {
                      type: 'string';
                    };
                    street_2: {
                      type: 'string';
                    };
                    city: {
                      type: 'string';
                    };
                    state: {
                      type: 'string';
                    };
                    zip: {
                      type: 'string';
                    };
                  };
                };
              };
            };
          };
        };
      };
      tags: ['Signatories'];
    };
    delete: {
      summary: 'Delete a signatory';
      operationId: 'delete-v1-companies-company_uuid-signatories-signatory_uuid';
      responses: {
        '204': {
          description: 'No Content';
        };
      };
      description: 'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nDelete a company signatory.';
      tags: ['Signatories'];
    };
  };
  '/v1/employees/{employee_id_or_uuid}/onboarding_status': {
    parameters: [
      {
        schema: {
          type: 'string';
        };
        name: 'employee_id_or_uuid';
        in: 'path';
        required: true;
        description: 'The UUID of the employee';
      },
    ];
    get: {
      summary: "Get the employee's onboarding status (Beta)";
      tags: ['Employees'];
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Onboarding-Status-Object';
        };
      };
      operationId: 'get-v1-employees-employee_id_or_uuid-onboarding_status';
      description: "# Description\nRetrieves an employee's onboarding status. The data returned helps inform the required onboarding steps and respective completion status.\n\n## Beta Endpoint\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n";
    };
  };
};
export const paths = {
  '/v1/employees/{employee_id_or_uuid}': {
    get: {
      summary: 'Get an employee',
      operationId: 'get-v1-employees',
      description: 'Get an employee.\n\n`scope: employees.read`\n',
      parameters: [
        {
          in: 'query',
          name: 'include',
          description: 'Include the requested attribute(s) in each employee response',
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['custom_fields'],
            },
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object',
        },
      },
      tags: ['Employees'],
    },
    put: {
      summary: 'Update an employee',
      operationId: 'put-v1-employees',
      description: 'Update an employee.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                first_name: {
                  type: 'string',
                },
                middle_initial: {
                  type: 'string',
                },
                last_name: {
                  type: 'string',
                },
                date_of_birth: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
                ssn: {
                  type: 'string',
                  pattern: '[0-9]{9}',
                },
                two_percent_shareholder: {
                  type: 'boolean',
                  description:
                    'Whether the employee is a two percent shareholder of the company. This field only applies to companies with an S-Corp entity type.',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: 'db0edd04aaac4506f7edab03ac855d56',
                  first_name: 'Soren',
                  middle_initial: 'A',
                  last_name: 'Kierkegaard',
                  date_of_birth: '1995-05-05',
                  email: 'knight0faith@example.com',
                  ssn: '123456294',
                  two_percent_shareholder: false,
                },
              },
            },
          },
        },
        description: 'Update an employee.',
      },
      parameters: [],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object',
        },
      },
      tags: ['Employees'],
    },
    delete: {
      summary: 'Delete an onboarding employee',
      operationId: 'delete-v1-employee',
      description:
        'Use this endpoint to delete an employee who is in onboarding. Deleting an onboarded employee is not allowed. Please check out the Terminations api if you need to terminate an onboarded employee.',
      parameters: [],
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      tags: ['Employees'],
    },
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
  },
  '/v1/employees/{employee_id_or_uuid}/finish_onboarding': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    put: {
      summary: 'Finish onboarding an employee',
      operationId: 'put-v1-employee-finish-onboarding',
      parameters: [],
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCall this endpoint as the very last step of employee onboarding to complete their onboarding. When successful, the employee's `onboarded` attribute will be updated to true, indicating that they can be included in company's payrolls.",
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Object',
        },
      },
      tags: ['Employees'],
    },
  },
  '/v1/companies/{company_id_or_uuid}': {
    get: {
      summary: 'Get a company',
      operationId: 'get-v1-companies',
      description: 'Get a company.\n\n`scope: companies.read`',
      parameters: [],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Object',
        },
      },
      tags: ['Companies'],
    },
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the company',
        required: true,
      },
    ],
  },
  '/v1/companies/{company_uuid}/onboarding_status': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the company',
      },
    ],
    get: {
      summary: "Get the company's onboarding status",
      operationId: 'get-v1-company-onboarding-status',
      parameters: [],
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet company's onboarding status. The data returned helps inform the required onboarding steps and respective completion status.",
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Onboarding-Status-Object',
        },
      },
      tags: ['Companies'],
    },
  },
  '/v1/companies/{company_uuid}/finish_onboarding': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the company',
      },
    ],
    put: {
      summary: 'Finish company onboarding',
      operationId: 'get-v1-company-finish-onboarding',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUse this endpoint to finalize company onboarding.',
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Onboarding-Status-Object',
        },
      },
      tags: ['Companies'],
    },
  },
  '/v1/companies/{company_id_or_uuid}/employees': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get employees of a company',
      operationId: 'get-v1-companies-company_id-employees',
      parameters: [
        {
          schema: {
            type: 'boolean',
          },
          in: 'query',
          name: 'terminated',
          description: 'Filters employees by the provided boolean',
        },
        {
          in: 'query',
          name: 'include',
          description: 'Include the requested attribute(s) in each employee response',
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['custom_fields'],
            },
          },
        },
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      description:
        'Get all of the employees, onboarding, active and terminated, for a given company.\n\n`scope: employees.read`',
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-List',
        },
      },
      tags: ['Employees'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {},
            },
          },
        },
      },
    },
    post: {
      summary: 'Create an employee',
      operationId: 'post-v1-employees',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                first_name: {
                  type: 'string',
                },
                middle_initial: {
                  type: 'string',
                },
                last_name: {
                  type: 'string',
                },
                date_of_birth: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
                ssn: {
                  type: 'string',
                  pattern: '[0-9]{9}',
                },
              },
            },
            examples: {
              Example: {
                value: {
                  first_name: 'Soren',
                  middle_initial: 'A',
                  last_name: 'Kierkegaard',
                  date_of_birth: '1995-05-05',
                  email: 'knight0faith@example.com',
                  ssn: '123456294',
                },
              },
            },
          },
        },
        description: 'Create an employee.',
      },
      parameters: [],
      description: 'Create an employee.\n\n`scope: employees.write`',
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Object',
        },
      },
      tags: ['Employees'],
    },
  },
  '/v1/jobs/{job_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'job_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the job',
      },
    ],
    get: {
      summary: 'Get a job',
      responses: {
        '200': {
          $ref: '#/components/responses/Job-Object',
        },
      },
      operationId: 'get-v1-jobs-job_id',
      parameters: [],
      description: 'Get a job.\n\n`scope: jobs.read`',
      tags: ['Jobs'],
    },
    put: {
      summary: 'Update a job',
      responses: {
        '200': {
          $ref: '#/components/responses/Job-Object',
        },
      },
      operationId: 'put-v1-jobs-job_id',
      description: 'Update a job.\n\n`scope: jobs.write`',
      parameters: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                title: {
                  type: 'string',
                },
                location_id: {
                  type: 'number',
                },
                hire_date: {
                  type: 'string',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: 'gr78930htutrz444kuytr3s5hgxykuveb523fwl8sir',
                  title: 'Regional Manager',
                  location_id: 1363316536327002,
                  hire_date: '2020-12-21',
                },
              },
            },
          },
        },
        description: 'Update a job.',
      },
      tags: ['Jobs'],
    },
    delete: {
      summary: 'Delete an individual job',
      tags: ['Jobs'],
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      operationId: 'delete-v1-jobs-job_id',
      description: 'Deletes a specific job that an employee holds.\n\n`scope: jobs.write`',
    },
  },
  '/v1/employees/{employee_id_or_uuid}/jobs': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The employee ID or UUID',
      },
    ],
    get: {
      summary: 'Get jobs for an employee',
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Job-List',
        },
      },
      operationId: 'get-v1-employees-employee_id-jobs',
      description: 'Get all of the jobs that an employee holds.\n\n`scope: jobs.read`',
      tags: ['Jobs'],
    },
    post: {
      summary: 'Create a job',
      responses: {
        '201': {
          $ref: '#/components/responses/Job-Object',
        },
      },
      operationId: 'post-v1-jobs-job_id',
      description: 'Create a job.\n\n`scope: jobs.write`',
      parameters: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                },
                location_id: {
                  type: 'number',
                },
                hire_date: {
                  type: 'string',
                },
              },
            },
            examples: {
              Example: {
                value: {
                  title: 'Regional Manager',
                  location_id: 1363316536327002,
                  hire_date: '2020-12-21',
                },
              },
            },
          },
        },
        description: 'Create a job.',
      },
      tags: ['Jobs'],
    },
  },
  '/v1/companies/{company_id_or_uuid}/locations': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get company locations',
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Location-List',
        },
      },
      operationId: 'get-v1-companies-company_id-locations',
      description:
        'Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n\nSince all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n\n`scope: companies.read`',
      tags: ['Locations'],
    },
    post: {
      summary: 'Create a company location',
      responses: {
        '201': {
          $ref: '#/components/responses/Location-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-locations',
      description:
        'Company locations represent all addresses associated with a company. These can be filing addesses, mailing addresses, and/or work locations; one address may serve multiple, or all, purposes.\n\nSince all company locations are subsets of locations, retrieving or updating an individual record should be done via the locations endpoints.\n\nscope: companies.write',
      parameters: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                phone_number: {
                  type: 'string',
                  pattern: '[0-9]{10}',
                },
                street_1: {
                  type: 'string',
                },
                street_2: {
                  type: 'string',
                  nullable: true,
                },
                city: {
                  type: 'string',
                },
                state: {
                  type: 'string',
                },
                zip: {
                  type: 'string',
                },
                country: {
                  type: 'string',
                  default: 'USA',
                },
                mailing_address: {
                  type: 'boolean',
                  description: "Specify if this location is the company's mailing address.",
                },
                filing_address: {
                  type: 'boolean',
                  description: "Specify if this location is the company's filing address.",
                },
              },
              required: ['phone_number', 'street_1', 'city', 'state', 'zip'],
            },
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383',
                  street_1: '425 2nd Street',
                  street_2: 'Suite 602',
                  city: 'San Francisco',
                  state: 'CA',
                  zip: '94107',
                  country: 'USA',
                },
              },
            },
          },
          'application/xml': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                phone_number: {
                  type: 'string',
                  minLength: 1,
                },
                street_1: {
                  type: 'string',
                  minLength: 1,
                },
                street_2: {
                  type: 'string',
                  nullable: true,
                  minLength: 1,
                },
                city: {
                  type: 'string',
                  minLength: 1,
                },
                state: {
                  type: 'string',
                  minLength: 1,
                },
                zip: {
                  type: 'string',
                  minLength: 1,
                },
                country: {
                  type: 'string',
                  minLength: 1,
                },
              },
              required: ['phone_number', 'street_1', 'street_2', 'city', 'state', 'zip', 'country'],
            },
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383',
                  street_1: '425 2nd Street',
                  street_2: 'Suite 602',
                  city: 'San Francisco',
                  state: 'CA',
                  zip: '94107',
                  country: 'USA',
                },
              },
            },
          },
        },
        description: 'Create a company location.',
      },
      tags: ['Locations'],
    },
  },
  '/v1/locations/{location_id}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'location_id',
        in: 'path',
        required: true,
        description: 'The ID of the location',
      },
    ],
    get: {
      summary: 'Get a location',
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object',
        },
      },
      operationId: 'get-v1-locations-location_id',
      description: 'Get a location.\n\n`scope: companies.read`',
      parameters: [],
      tags: ['Locations'],
    },
    put: {
      summary: 'Update a location',
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object',
        },
      },
      operationId: 'put-v1-locations-location_id',
      description: 'Update a location.\n\nscope: companies.write',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                phone_number: {
                  type: 'string',
                  pattern: '[0-9]{10}',
                },
                street_1: {
                  type: 'string',
                },
                street_2: {
                  type: 'string',
                  nullable: true,
                },
                city: {
                  type: 'string',
                },
                state: {
                  type: 'string',
                },
                zip: {
                  type: 'string',
                },
                country: {
                  type: 'string',
                },
                mailing_address: {
                  type: 'boolean',
                  description: "For a company location, specify if this location is the company's mailing address.",
                },
                filing_address: {
                  type: 'boolean',
                  description: "For a company location, specify if this location is the company's filing address.",
                },
              },
            },
            examples: {
              Example: {
                value: {
                  phone_number: '8009360383',
                  street_1: '425 2nd Street',
                  street_2: 'Suite 602',
                  city: 'San Francisco',
                  state: 'CA',
                  zip: '94107',
                  country: 'USA',
                },
              },
            },
          },
        },
        description: 'Update a location',
      },
      tags: ['Locations'],
    },
  },
  '/v1/contractors/{contractor_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'contractor_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the contractor',
      },
    ],
    get: {
      summary: 'Get a contractor',
      tags: ['Contractors'],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Object',
        },
      },
      operationId: 'get-v1-contractors-contractor_id',
      description: 'Get a contractor.\n\n`scope: employees.read`',
    },
    put: {
      summary: 'Update a contractor',
      tags: ['Contractors'],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Object',
        },
      },
      operationId: 'put-v1-contractors-contractor_id',
      description: 'Update a contractor.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                start_date: {
                  type: 'string',
                  description: 'The day when the contractor will start working for the company.\n',
                  example: '2020-01-11',
                },
                first_name: {
                  type: 'string',
                  description:
                    'The contractor’s first name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                last_name: {
                  type: 'string',
                  description:
                    'The contractor’s last name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                middle_initial: {
                  type: 'string',
                  description:
                    'null\tThe contractor’s middle initial. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                wage_type: {
                  type: 'string',
                  description: 'The contractor’s wage type, either “Fixed” or “Hourly”.\n',
                  enum: ['Fixed', 'Hourly'],
                },
                hourly_rate: {
                  type: 'string',
                  description: 'The contractor’s hourly rate. This attribute is required if the wage_type is “Hourly”.',
                  example: '40.0',
                },
                business_name: {
                  type: 'string',
                  description:
                    'The name of the contractor business. This attribute is required for “Business” contractors and will be ignored for “Individual” contractors.',
                },
                ein: {
                  type: 'string',
                  description:
                    'The employer identification number of the contractor business. This attribute is optional for “Business” contractors and will be ignored for “Individual” contractors.',
                },
              },
            },
            examples: {
              'Update an Individual Contractor': {
                value: {
                  version: 'b48c46abfed1487b873b442334b3c4ff',
                  start_date: '2021-01-01',
                  first_name: 'Chanel',
                  last_name: 'Boyle',
                  middle_initial: 'X',
                  wage_type: 'Hourly',
                  hourly_rate: '20.00',
                },
              },
              'Update a Business Contractor': {
                value: {
                  version: 'b48c46abfed1487b873b442334b3c4ff',
                  start_date: '2020-01-11',
                  business_name: 'Contracting Solutions',
                  ein: '991113334',
                  wage_type: 'Fixed',
                },
              },
            },
          },
        },
        description: '',
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/contractors': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get contractors of a company',
      tags: ['Contractors'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-List',
        },
      },
      operationId: 'get-v1-companies-company_id-contractors',
      description:
        'Get all contractors, active and inactive, individual and business, for a company.\n\n`scope: employees.read`',
    },
    post: {
      summary: 'Create a contractor',
      tags: ['Contractors'],
      responses: {
        '201': {
          $ref: '#/components/responses/Contractor-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-contractors',
      description: 'Create an individual or business contractor.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'The contractor type, either an “Individual” or a “Business”.\n',
                  enum: ['Individual', 'Business'],
                },
                wage_type: {
                  type: 'string',
                  enum: ['Hourly', 'Fixed'],
                  description: 'The contractor’s wage type, either “Fixed” or “Hourly”.\n',
                },
                first_name: {
                  type: 'string',
                  description:
                    'The contractor’s first name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                last_name: {
                  type: 'string',
                  description:
                    'The contractor’s last_name. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                start_date: {
                  type: 'string',
                  example: '2020-10-10',
                  description: 'The day when the contractor will start working for the company.',
                },
                self_onboarding: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the contractor or the payroll admin will complete onboarding in Gusto. Self-onboarding is recommended so that contractors receive Gusto accounts. If self_onboarding is true, then email is required. ',
                },
                email: {
                  type: 'string',
                  description:
                    'The contractor’s email address. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                middle_initial: {
                  type: 'string',
                  description:
                    'The contractor’s middle initial. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.',
                },
                business_name: {
                  type: 'string',
                  description:
                    'The name of the contractor business. This attribute is required for “Business” contractors and will be ignored for “Individual” contractors.',
                },
                ein: {
                  type: 'string',
                  description:
                    'The employer identification number of the contractor business. This attribute is optional for “Business” contractors and will be ignored for “Individual” contractors.',
                },
              },
              required: ['type', 'wage_type', 'start_date'],
            },
            examples: {
              'Create an Individual contractor': {
                value: {
                  type: 'Individual',
                  wage_type: 'Fixed',
                  first_name: 'Johnson',
                  last_name: 'Johnson',
                  start_date: '2020-04-01',
                  self_onboarding: true,
                  email: 'johnson@johnson.com',
                },
              },
              'Create a Business contractor': {
                value: {
                  type: 'Business',
                  wage_type: 'Fixed',
                  business_name: 'Johnson-Johnson Contractors',
                  start_date: '2020-04-01',
                },
              },
            },
          },
        },
        description: 'Create an individual or business contractor.',
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/contractor_payments': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get contractor payments for a company',
      tags: ['Contractor Payments'],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payments',
        },
      },
      operationId: 'get-v1-companies-company_id-contractor_payments',
      description:
        'Returns an object containing individual contractor payments, within a given time period, including totals.\n\n`scope: payrolls.read`',
      parameters: [
        {
          schema: {
            type: 'string',
            example: '2020-01-01',
          },
          in: 'query',
          name: 'start_date',
          description: 'The time period for which to retrieve contractor payments',
          required: true,
        },
        {
          schema: {
            type: 'string',
            example: '2020-12-31',
          },
          in: 'query',
          name: 'end_date',
          description: 'The time period for which to retrieve contractor payments',
          required: true,
        },
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
    },
    post: {
      summary: 'Create a contractor payment',
      tags: ['Contractor Payments'],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payment-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-contractor_payments',
      description:
        'Returns an object containing individual contractor payments, within a given time period, including totals.\n\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.',
      parameters: [
        {
          schema: {
            type: 'string',
            example: '2020-01-01',
          },
          in: 'query',
          required: true,
          name: 'date',
          description: 'The payment date',
        },
        {
          schema: {
            type: 'number',
            example: 7757515807748202,
          },
          in: 'query',
          required: true,
          name: 'contractor_id',
          description: 'The contractor receiving the payment',
        },
        {
          schema: {
            type: 'number',
            example: 5000,
          },
          in: 'query',
          name: 'wage',
          description:
            'If the contractor is on a fixed wage, this is the fixed wage payment for the contractor, regardless of hours worked.',
        },
        {
          schema: {
            type: 'number',
            example: 40,
          },
          in: 'query',
          name: 'hours',
          description:
            'If the contractor is on an hourly wage, this is the number of hours that the contractor worked for the payment.',
        },
        {
          schema: {
            type: 'number',
            example: 500,
          },
          in: 'query',
          name: 'bonus',
          description: 'If the contractor is on an hourly wage, this is the bonus the contractor earned.',
        },
        {
          schema: {
            type: 'number',
            example: 20,
          },
          in: 'query',
          name: 'reimbursement',
          description: 'Reimbursed wages for the contractor .',
        },
      ],
    },
  },
  '/v1/companies/{company_id_or_uuid}/contractor_payments/{contractor_payment_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'contractor_payment_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the contractor payment',
      },
    ],
    get: {
      summary: 'Get a single contractor payment',
      tags: ['Contractor Payments'],
      responses: {
        '200': {
          $ref: '#/components/responses/Contractor-Payment-Object',
        },
      },
      operationId: 'get-v1-companies-company_id-contractor_payment-contractor-payment',
      description: 'Returns a single contractor payments\n\n`scope: payrolls.read`',
    },
    delete: {
      summary: 'Cancel a contractor payment',
      tags: ['Contractor Payments'],
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      operationId: 'delete-v1-companies-company_id-contractor_payment-contractor-payment',
      description:
        'Cancels and deletes a contractor payment. If the contractor payment has already started processing, the payment cannot be cancelled.\n\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.',
      'x-internal': false,
    },
  },
  '/v1/compensations/{compensation_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'compensation_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the compensation',
      },
    ],
    get: {
      summary: 'Get a compensation',
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-Object',
        },
      },
      operationId: 'get-v1-compensations-compensation_id',
      description:
        'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n\n`scope: jobs.read`\n',
      tags: ['Compensations'],
    },
    put: {
      summary: 'Update a compensation',
      tags: ['Compensations'],
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-Object',
        },
      },
      operationId: 'put-v1-compensations-compensation_id',
      description:
        'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n\n`scope: jobs.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                  readOnly: true,
                },
                rate: {
                  type: 'string',
                  readOnly: false,
                  description: 'The dollar amount paid per payment unit.',
                },
                payment_unit: {
                  type: 'string',
                  readOnly: false,
                  description:
                    "The unit accompanying the compensation rate. If the employee is an owner, rate should be 'Paycheck'.",
                  enum: ['Hour', 'Week', 'Month', 'Year', 'Paycheck'],
                },
                flsa_status: {
                  type: 'string',
                  readOnly: false,
                  description:
                    "The FLSA status for this compensation. Salaried ('Exempt') employees are paid a fixed salary every pay period. Salaried with overtime ('Salaried Nonexempt') employees are paid a fixed salary every pay period, and receive overtime pay when applicable. Hourly ('Nonexempt') employees are paid for the hours they work, and receive overtime pay when applicable. Owners ('Owner') are employees that own at least twenty percent of the company. ",
                  enum: ['Exempt', 'Salaried Nonexempt', 'Nonexempt', 'Owner'],
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872',
                  rate: '60000.00',
                  payment_unit: 'Year',
                  flsa_status: 'Exempt',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/jobs/{job_id_or_uuid}/compensations': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'job_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the job to which the compensation belongs',
      },
    ],
    get: {
      summary: 'Get compensations for a job',
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Compensation-List',
        },
      },
      operationId: 'get-v1-jobs-job_id-compensations',
      description:
        'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error.\n\nUse the `flsa_status` to determine if an employee is elibgle for overtime.\n\n`scope: jobs.read`',
      tags: ['Compensations'],
    },
    post: {
      summary: 'Create a compensation',
      tags: ['Jobs'],
      operationId: 'post-v1-jobs-job_id-compensations',
      description:
        'Compensations contain information on how much is paid out for a job. Jobs may have many compensations, but only one that is active. The current compensation is the one with the most recent `effective_date`.\n\nNote: Currently, jobs are arbitrarily limited to a single compensation as multiple compensations per job are not yet available in Gusto. The API is architected as if multiple compensations may exist, so integrations should integrate under the same assumption. The only exception is that creating a compensation with the same `job_id` as another will fail with a relevant error\n\n`scope: jobs.write`',
      responses: {
        '201': {
          $ref: '#/components/responses/Compensation-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                rate: {
                  type: 'string',
                  readOnly: false,
                  description: 'The dollar amount paid per payment unit.',
                },
                payment_unit: {
                  type: 'string',
                  readOnly: false,
                  description:
                    "The unit accompanying the compensation rate. If the employee is an owner, rate should be 'Paycheck'.",
                  enum: ['Hour', 'Week', 'Month', 'Year', 'Paycheck'],
                },
                flsa_status: {
                  type: 'string',
                  readOnly: false,
                  description:
                    "The FLSA status for this compensation. Salaried ('Exempt') employees are paid a fixed salary every pay period. Salaried with overtime ('Salaried Nonexempt') employees are paid a fixed salary every pay period, and receive overtime pay when applicable. Hourly ('Nonexempt') employees are paid for the hours they work, and receive overtime pay when applicable. Owners ('Owner') are employees that own at least twenty percent of the company. ",
                  enum: ['Exempt', 'Salaried Nonexempt', 'Nonexempt', 'Owner'],
                },
                effective_date: {
                  type: 'string',
                  description:
                    "The effective date for this compensation. For the first compensation, this defaults to the job's hire date.",
                },
              },
              required: ['rate', 'payment_unit', 'flsa_status'],
            },
            examples: {
              Example: {
                value: {
                  rate: '60000.00',
                  payment_unit: 'Year',
                  flsa_status: 'Exempt',
                  effective_date: '2020-03-15',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/garnishments': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee to which the garnishment belongs',
      },
    ],
    get: {
      summary: 'Get garnishments for an employee',
      tags: ['Garnishments'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-List',
        },
      },
      operationId: 'get-v1-employees-employee_id-garnishments',
      description:
        'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.read`',
    },
    post: {
      summary: 'Create a garnishment',
      tags: ['Garnishments'],
      responses: {
        '201': {
          $ref: '#/components/responses/Garnishment-Object',
        },
      },
      operationId: 'post-v1-employees-employee_id-garnishments',
      description:
        'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether or not this garnishment is currently active.',
                },
                amount: {
                  type: 'string',
                  format: 'float',
                  readOnly: false,
                  description:
                    'The amount of the garnishment. Either a percentage or a fixed dollar amount. Represented as a float, e.g. "8.00".',
                },
                description: {
                  type: 'string',
                  readOnly: false,
                  description: 'The description of the garnishment.',
                },
                court_ordered: {
                  type: 'boolean',
                  readOnly: false,
                  description: 'Whether the garnishment is court ordered.',
                },
                times: {
                  type: 'integer',
                  readOnly: false,
                  default: null,
                  nullable: true,
                  description: 'The number of times to apply the garnisment. Ignored if recurring is true.',
                },
                recurring: {
                  type: 'boolean',
                  readOnly: false,
                  default: false,
                  description: 'Whether the garnishment should recur indefinitely.',
                },
                annual_maximum: {
                  format: 'float',
                  readOnly: false,
                  default: null,
                  nullable: true,
                  description:
                    'The maximum deduction per annum. A null value indicates no maximum. Represented as a float, e.g. "200.00".',
                  type: 'string',
                },
                pay_period_maximum: {
                  type: 'string',
                  format: 'float',
                  default: null,
                  nullable: true,
                  description:
                    'The maximum deduction per pay period. A null value indicates no maximum. Represented as a float, e.g. "16.00".',
                },
                deduct_as_percentage: {
                  type: 'boolean',
                  readOnly: false,
                  default: false,
                  description: 'Whether the amount should be treated as a percentage to be deducted per pay period.',
                },
              },
              required: ['amount', 'description', 'court_ordered'],
            },
            examples: {
              Example: {
                value: {
                  amount: '150.00',
                  description: 'Back taxes',
                  court_ordered: true,
                  recurring: true,
                  deduct_as_percentage: false,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/garnishments/{garnishment_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'garnishment_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the garnishment',
      },
    ],
    get: {
      summary: 'Get a garnishment',
      tags: ['Garnishments'],
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-Object',
        },
      },
      operationId: 'get-v1-garnishments-garnishment_id',
      description:
        'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.read`',
    },
    put: {
      summary: 'Update a garnishment',
      tags: ['Garnishments'],
      responses: {
        '200': {
          $ref: '#/components/responses/Garnishment-Object',
        },
      },
      operationId: 'put-v1-garnishments-garnishment_id',
      description:
        'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether or not this garnishment is currently active.',
                },
                amount: {
                  type: 'string',
                  format: 'float',
                  readOnly: false,
                  description:
                    'The amount of the garnishment. Either a percentage or a fixed dollar amount. Represented as a float, e.g. "8.00".',
                },
                description: {
                  type: 'string',
                  readOnly: false,
                  description: 'The description of the garnishment.',
                },
                court_ordered: {
                  type: 'boolean',
                  readOnly: false,
                  description: 'Whether the garnishment is court ordered.',
                },
                times: {
                  type: 'integer',
                  readOnly: false,
                  default: null,
                  nullable: true,
                  description: 'The number of times to apply the garnisment. Ignored if recurring is true.',
                },
                recurring: {
                  type: 'boolean',
                  readOnly: false,
                  default: false,
                  description: 'Whether the garnishment should recur indefinitely.',
                },
                annual_maximum: {
                  format: 'float',
                  readOnly: false,
                  default: null,
                  nullable: true,
                  description:
                    'The maximum deduction per annum. A null value indicates no maximum. Represented as a float, e.g. "200.00".',
                  type: 'string',
                },
                pay_period_maximum: {
                  type: 'string',
                  format: 'float',
                  default: null,
                  nullable: true,
                  description:
                    'The maximum deduction per pay period. A null value indicates no maximum. Represented as a float, e.g. "16.00".',
                },
                deduct_as_percentage: {
                  type: 'boolean',
                  readOnly: false,
                  default: false,
                  description: 'Whether the amount should be treated as a percentage to be deducted per pay period.',
                },
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '52b7c567242cb7452e89ba2bc02cb476',
                  active: false,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/terminations': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    get: {
      summary: 'Get terminations for an employee',
      tags: ['Terminations'],
      responses: {
        '200': {
          $ref: '#/components/responses/Termination-List',
        },
      },
      operationId: 'get-v1-employees-employee_id-terminations',
      description:
        'Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n\nNote that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n\n`scope: employees.read`',
    },
    post: {
      summary: 'Create an employee termination',
      tags: ['Terminations'],
      responses: {
        '201': {
          $ref: '#/components/responses/Termination-Object',
        },
      },
      operationId: 'post-v1-employees-employee_id-terminations',
      description:
        'Terminations are created whenever an employee is scheduled to leave the company. The only things required are an effective date (their last day of work) and whether they should receive their wages in a one-off termination payroll or with the rest of the company.\n\nNote that some states require employees to receive their final wages within 24 hours (unless they consent otherwise,) in which case running a one-off payroll may be the only option.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                effective_date: {
                  type: 'string',
                  description: "The employee's last day of work.",
                },
                run_termination_payroll: {
                  type: 'boolean',
                  description:
                    'If true, the employee should recieve their final wages via an offcycle payroll. If false, they should recieve their final wages on their current pay schedule.',
                },
              },
            },
            examples: {
              Example: {
                value: {
                  effective_date: '2020-06-30',
                  run_termination_payroll: true,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/time_off_requests': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get time off requests for a company',
      tags: ['Time Off Requests'],
      responses: {
        '200': {
          $ref: '#/components/responses/Time-Off-Request-List',
        },
      },
      operationId: 'get-v1-companies-company_id-time_off_requests',
      description:
        "Get all time off requests, past and present, for a company.\n\nIn order to reduce the number of time off requests returned in a single response, or to retrieve time off requests from a time period of interest, you may use the `start_date` and `end_date` parameters.\n\nYou may provide both or either parameters to scope the returned data. For example:\n\n`?start_date='2019-01-01'`\n\nReturns all time off requests where the request start date is equal to or after January 1, 2019.\n\n`?end_date='2019-01-01'`\n\nReturns all time off requests where the request end date is equal to or before January 1, 2019.\n\n`?start_date='2019-05-01'&end_date='2019-08-31'`\n\nReturns all time off requests where the request start date is equal to or after May 1, 2019 and the request end date is equal to or before August 31, 2019.\n\n`scope: time_off_requests.read`",
      parameters: [
        {
          schema: {
            type: 'string',
            example: '"2019-05-01"',
          },
          in: 'query',
          name: 'start_date',
          description: 'Filter time off requests where the request start date is equal to or after this parameter',
        },
        {
          schema: {
            type: 'string',
            example: '"2019-08-31"',
          },
          in: 'query',
          name: 'end_date',
          description: 'Filter time off requests where the request end date is equal to or after this parameter',
        },
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
    },
  },
  '/v1/me': {
    get: {
      summary: 'Get the current user',
      tags: ['Current User'],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Current-User',
              },
              examples: {
                Example: {
                  value: {
                    id: 1409720965546346,
                    email: 'torrance.considine1409720965546346@schuster.info',
                    roles: {
                      payroll_admin: {
                        companies: [
                          {
                            id: 1409720965614302,
                            name: 'Crist-Balistreri Group',
                            tier: 'core',
                            trade_name: 'Wyman and Sons LLC',
                            locations: [
                              {
                                id: 1409721224078163,
                                street_1: '63932 Jalyn Springs',
                                street_2: 'Apt. 445',
                                city: 'Cannon Beach',
                                state: 'OR',
                                zip: '97110',
                                country: 'USA',
                                active: true,
                              },
                              {
                                id: 1409721315748742,
                                street_1: '1152 River Villages',
                                street_2: 'Apt. 563',
                                city: 'Cannon Beach',
                                state: 'OR',
                                zip: '97110',
                                country: 'USA',
                                active: true,
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'get-v1-me',
      description: 'Returns information pertaining to the user associated with the provided access token.',
    },
  },
  '/v1/terms_of_service': {
    get: {
      summary: 'Get the terms of service acceptance',
      tags: ['Terms of Service (Beta)'],
      responses: {
        '200': {
          description: 'Example response',
          content: {
            'application/json': {
              schema: {
                description: '',
                type: 'object',
                properties: {
                  latest_terms_accepted: {
                    type: 'boolean',
                    description: 'Whether the latest terms have been accepted by the user.',
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    latest_terms_accepted: true,
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'get-v1-terms-of-service',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns whether the latest terms of service for Gusto Embedded Payroll has been accepted by the current user.',
    },
    post: {
      summary: 'Accept the latest terms of service',
      tags: ['Terms of Service (Beta)'],
      responses: {
        '200': {
          description: 'Example response',
          content: {
            'application/json': {
              schema: {
                description: '',
                type: 'object',
                properties: {
                  latest_terms_accepted: {
                    type: 'boolean',
                    description: 'Whether the latest terms have been accepted by the user.',
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    latest_terms_accepted: true,
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'post-v1-terms-of-service',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nAccepts the latest terms of service for Gusto Embedded Payroll for the current user.',
    },
  },
  '/v1/employees/{employee_uuid}/federal_taxes': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the employee',
      },
    ],
    get: {
      summary: "Get an employee's federal taxes",
      tags: ['Employee Federal Tax'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Federal-Tax-Object',
        },
      },
      operationId: 'get-v1-employees-employee_id-federal_taxes',
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet attributes relevant for an employee's federal taxes.",
    },
    put: {
      summary: "Update an employee's federal taxes",
      tags: ['Employee Federal Tax'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Federal-Tax-Object',
        },
      },
      operationId: 'put-v1-employees-employee_id-federal_taxes',
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate attributes relevant for an employee's federal taxes.",
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                filing_status: {
                  type: 'string',
                },
                extra_withholding: {
                  type: 'string',
                  nullable: true,
                },
                two_jobs: {
                  type: 'boolean',
                },
                dependents_amount: {
                  type: 'string',
                },
                other_income: {
                  type: 'string',
                },
                deductions: {
                  type: 'string',
                },
                w4_data_type: {
                  type: 'string',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '56a489ce86ed6c1b0f0cecc4050a0b01',
                  filing_status: 'Single',
                  extra_withholding: '0.0',
                  two_jobs: true,
                  dependents_amount: '0.0',
                  other_income: '0.0',
                  deductions: '0.0',
                  w4_data_type: 'rev_2020_w4',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_uuid}/state_taxes': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the employee',
      },
    ],
    get: {
      summary: "Get an employee's state taxes",
      tags: ['Employee State Tax'],
      operationId: 'get-v1-employees-employee_id-state_taxes',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet attributes relevant for an employee\'s state taxes.\n\nThe data required to correctly calculate an employee\'s state taxes varies by both home and work location. This API returns information about each question that must be answered grouped by state. Mostly commonly, an employee lives and works in the same state and will only have questions for a single state. The response contains metadata about each question, the type of answer expected, and the current answer stored in Gusto for that question.\n\nAnswers are represented by an array. Today, this array can only be empty or contain exactly one element, but is designed to allow for forward compatibility with effective-dated fields. Until effective dated answers are supported, the `valid_from` and `valid_up_to` must always be `"2010-01-01"` and `null` respectively.\n',
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-State-Taxes-List',
        },
      },
    },
    put: {
      summary: "Update an employee's state taxes",
      tags: ['Employee State Tax'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-State-Taxes-List',
        },
        '422': {
          description: 'Unprocessable Entity (WebDAV)',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                description: '',
                uniqueItems: true,
                'x-examples': {
                  'example-1': [
                    {
                      state: 'CA',
                      questions: [
                        {
                          key: 'filing_status',
                          answers: [
                            {
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                              errors: ['string'],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                items: {
                  type: 'object',
                  properties: {
                    state: {
                      type: 'string',
                    },
                    questions: {
                      type: 'array',
                      uniqueItems: true,
                      items: {
                        type: 'object',
                        properties: {
                          key: {
                            type: 'string',
                          },
                          answers: {
                            type: 'array',
                            uniqueItems: true,
                            items: {
                              type: 'object',
                              properties: {
                                valid_from: {
                                  type: 'string',
                                },
                                valid_up_to: {
                                  nullable: true,
                                },
                                errors: {
                                  type: 'array',
                                  items: {
                                    type: 'string',
                                  },
                                },
                              },
                              required: ['valid_from'],
                            },
                          },
                        },
                        required: ['key'],
                      },
                    },
                  },
                  required: ['state', 'questions'],
                },
              },
              examples: {
                'Employee-State-Taxes-Error-Response': {
                  value: [
                    {
                      state: 'CA',
                      questions: [
                        {
                          key: 'filing_status',
                          answers: [
                            {
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                              errors: ['string'],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      operationId: 'put-v1-employees-employee_id-state_taxes',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate attributes relevant for an employee\'s state taxes.\n\nAs described for the GET endpoint, the answers must be supplied in the effective-dated format, but currently only a single answer will be accepted - `valid_from` and `valid_up_to` must be `"2010-01-01"` and `null` respectively.\n',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              'x-examples': {
                'example-1': {
                  employee_id: '87156178-62f8-46d4-a026-ed9de3e8f836',
                  states: [
                    {
                      state: 'CA',
                      questions: [
                        {
                          key: 'filing_status',
                          answers: [
                            {
                              value: 'M',
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                        {
                          key: 'withholding_allowance',
                          answers: [
                            {
                              value: 2,
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                        {
                          key: 'additional_withholding',
                          answers: [
                            {
                              value: '25.0',
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
              properties: {
                employee_id: {
                  type: 'string',
                },
                states: {
                  type: 'array',
                  uniqueItems: true,
                  items: {
                    type: 'object',
                    properties: {
                      state: {
                        type: 'string',
                      },
                      questions: {
                        type: 'array',
                        uniqueItems: true,
                        items: {
                          type: 'object',
                          properties: {
                            key: {
                              type: 'string',
                            },
                            answers: {
                              type: 'array',
                              uniqueItems: true,
                              items: {
                                type: 'object',
                                properties: {
                                  value: {
                                    type: 'string',
                                  },
                                  valid_from: {
                                    type: 'string',
                                  },
                                  valid_up_to: {
                                    nullable: true,
                                  },
                                },
                                required: ['value', 'valid_from'],
                              },
                            },
                          },
                          required: ['key'],
                        },
                      },
                    },
                    required: ['state'],
                  },
                },
              },
              required: ['employee_id', 'states'],
            },
            examples: {
              'Employee-State-Taxes-Update-Example': {
                value: {
                  employee_id: '87156178-62f8-46d4-a026-ed9de3e8f836',
                  states: [
                    {
                      state: 'CA',
                      questions: [
                        {
                          key: 'filing_status',
                          answers: [
                            {
                              value: 'M',
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                        {
                          key: 'withholding_allowance',
                          answers: [
                            {
                              value: 2,
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                        {
                          key: 'additional_withholding',
                          answers: [
                            {
                              value: '25.0',
                              valid_from: '2010-01-01',
                              valid_up_to: null,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/home_address': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    get: {
      summary: "Get an employee's home address",
      tags: ['Employees'],
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object',
        },
      },
      operationId: 'get-v1-employees-employee_id-home_address',
      description:
        'The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n\n`scope: employees.read`',
    },
    put: {
      summary: "Update an employee's home address",
      tags: ['Employees'],
      responses: {
        '200': {
          $ref: '#/components/responses/Location-Object',
        },
      },
      operationId: 'put-v1-employees-employee_id-home_address',
      description:
        'The home address of an employee is used to determine certain tax information about them. Addresses are geocoded on create and update to ensure validity.\n\n`scope: employees.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                street_1: {
                  type: 'string',
                },
                street_2: {
                  type: 'string',
                  nullable: true,
                },
                city: {
                  type: 'string',
                },
                state: {
                  type: 'string',
                },
                zip: {
                  type: 'string',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: 'fe75bd065ff48b91c35fe8ff842f986c',
                  street_1: '300 3rd Street',
                  street_2: null,
                  city: 'San Francisco',
                  state: 'CA',
                  zip: '94107',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_uuid}/payment_configs': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        description: 'The UUID of the company',
        required: true,
      },
    ],
    get: {
      summary: "Get a company's payment configs",
      tags: ['Payment Configs (Beta)'],
      operationId: 'get-v1-company-payment-configs',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet fast payment limit (only applicable for 2-day payroll) and payment speed for the company.',
      responses: {
        '200': {
          $ref: '#/components/responses/Payment-Configs-Object',
        },
      },
    },
    put: {
      summary: "Update a company's payment configs",
      tags: ['Payment Configs (Beta)'],
      operationId: 'put-v1-company-payment-configs',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate fast payment limit (only applicable for 2-day payroll) and payment speed for the company.',
      responses: {
        '200': {
          $ref: '#/components/responses/Payment-Configs-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                fast_payment_limit: {
                  type: 'integer',
                  description:
                    'Fast payment limit (only applicable to 2-day payroll). This limit is an aggregate of all fast payrolls amount.',
                },
                payment_speed: {
                  type: 'string',
                  description: 'The payment speed',
                  enum: ['2-day', '4-day'],
                },
              },
              required: ['fast_payment_limit', 'payment_speed'],
            },
            examples: {
              Example: {
                value: {
                  fast_payment_limit: 5000,
                  payment_speed: '2-day',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/pay_schedules': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get the pay schedules for a company',
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-List',
        },
      },
      operationId: 'get-v1-companies-company_id-pay_schedules',
      description:
        'The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n\n`scope: payrolls.read`',
      tags: ['Pay Schedules'],
    },
    post: {
      summary: 'Create a new single pay schedule',
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-pay_schedules',
      description:
        'Creates a new single default pay schedule for the company.\n\nThis creates one pay schedule during company onboarding and cannot be used if the company has processed a payroll. Creating multiple pay schedules at this time is not supported. To change a pay schedule, the end user will need to login to Gusto to edit their pay schedule.\n\nBe sure to **[check state laws](https://www.dol.gov/agencies/whd/state/payday)** to know what schedule is right for your customers.\n\nThis endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto',
      tags: ['Pay Schedules'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                frequency: {
                  type: 'string',
                  description: 'The frequency that employees on this pay schedule are paid with Gusto.',
                  enum: ['Every week', 'Every other week', 'Twice per month', 'Monthly'],
                },
                anchor_pay_date: {
                  type: 'string',
                  description: 'The first date that employees on this pay schedule are paid with Gusto.',
                },
                anchor_end_of_pay_period: {
                  type: 'string',
                  description:
                    'The last date of the first pay period. This can be the same date as the anchor pay date.',
                },
                day_1: {
                  type: 'integer',
                  description:
                    'An integer between 1 and 31 indicating the first day of the month that employees are paid. This field is only relevant for pay schedules with the “Twice per month” and “Monthly” frequencies. It will be null for pay schedules with other frequencies.',
                  nullable: true,
                },
                day_2: {
                  description:
                    'An integer between 1 and 31 indicating the second day of the month that employees are paid. This field is the second pay date for pay schedules with the “Twice per month” frequency. It will be null for pay schedules with other frequencies.',
                  type: 'integer',
                  nullable: true,
                },
              },
              required: ['frequency', 'anchor_pay_date', 'anchor_end_of_pay_period'],
            },
            examples: {
              Example: {
                value: {
                  frequency: 'Twice per month',
                  anchor_pay_date: '2021-10-15',
                  anchor_end_of_pay_period: '2021-10-15',
                  day_1: 15,
                  day_2: 31,
                  auto_pilot: false,
                  version: '68934a3e9455fa72420237eb05902327',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/industry_selection': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the company',
        required: true,
      },
    ],
    get: {
      summary: 'Get Company Industry Selection',
      tags: ['Industry'],
      operationId: 'get-v1-company-industry',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet industry selection for the company.',
      responses: {
        '200': {
          $ref: '#/components/responses/Industry-Object',
        },
      },
    },
    put: {
      summary: 'Update a company industry selection',
      tags: ['Industry'],
      operationId: 'put-v1-company-industry',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate the company industry selection by passing in industry classification codes: [NAICS code](https://www.naics.com), [SICS code](https://siccode.com/) and industry title. Our UI is leveraging [Middesk API](https://docs.middesk.com/reference/introduction) to determine industry classification codes.',
      responses: {
        '200': {
          $ref: '#/components/responses/Industry-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Industry title',
                },
                naics_code: {
                  type: 'string',
                  description:
                    'North American Industry Classification System (NAICS) is used to classify businesses with a six digit number based on the primary type of work the business performs',
                },
                sic_codes: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description:
                    'A list of Standard Industrial Classification (SIC) codes, which are four digit number that categorize the industries that companies belong to based on their business activities.',
                },
              },
              required: ['title', 'naics_code', 'sic_codes'],
            },
            examples: {
              Example: {
                value: {
                  title: 'Computer Training',
                  naics_code: '611420',
                  sic_codes: ['8243'],
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/pay_schedules/{pay_schedule_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'pay_schedule_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the pay schedule',
      },
    ],
    get: {
      summary: 'Get a pay schedule',
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object',
        },
      },
      operationId: 'get-v1-companies-company_id-pay_schedules-pay_schedule_id',
      description:
        'The pay schedule object in Gusto captures the details of when employees work and when they should be paid. A company can have multiple pay schedules.\n\n`scope: payrolls.read`',
      tags: ['Pay Schedules'],
    },
    put: {
      summary: 'Update a pay schedule',
      tags: ['Pay Schedules'],
      responses: {
        '200': {
          $ref: '#/components/responses/Pay-Schedule-Object',
        },
      },
      operationId: 'put-v1-companies-company_id-pay_schedules-pay_schedule_id',
      description:
        'Updates a pay schedule.\n\nThis endpoint is in beta. Please contact developer-gws@gusto.com if you’d like to have more information and use it for production. Note, this may require you to enter a different agreement with Gusto',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                auto_pilot: {
                  type: 'boolean',
                  description:
                    'With Autopilot® enabled, payroll will run automatically one day before your payroll deadlines.',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872',
                  auto_pilot: true,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/bank_accounts': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get all company bank accounts',
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Bank-Account-List',
        },
      },
      operationId: 'get-v1-companies-company_id-bank-accounts',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns company bank accounts. Currently we only support a single default bank account per company.',
      tags: ['Company Bank Accounts'],
    },
    post: {
      summary: 'Create a company bank account',
      operationId: 'post-v1-companies-company_id-bank-accounts',
      tags: ['Company Bank Accounts'],
      responses: {
        '201': {
          $ref: '#/components/responses/Company-Bank-Account-Object',
        },
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nThis endpoint creates a new company bank account.\nIf a default bank account exists, the new bank account will replace it as the company's default funding method.\nUpon being created, two verification deposits are automatically sent to the bank account, and the bank account's verification_status is 'awaiting_deposits'.\nWhen the deposits are successfully transferred, the verification_status changes to 'ready_for_verification', at which point the verify endpoint can be used to verify the bank account.\nAfter successful verification, the bank account's verification_status is 'verified'.",
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                routing_number: {
                  type: 'string',
                  nullable: false,
                  description: 'The bank routing number',
                },
                account_number: {
                  type: 'string',
                  nullable: false,
                  description: 'The bank account number',
                },
                account_type: {
                  type: 'string',
                  nullable: false,
                  description: 'The bank account type',
                  enum: ['Checking', 'Savings'],
                },
              },
            },
            examples: {
              Example: {
                value: {
                  routing_number: '115092013',
                  account_type: 'Checking',
                  account_number: '9775014007',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/bank_accounts/{bank_account_uuid}/verify': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the bank account',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'bank_account_uuid',
        in: 'path',
        required: true,
        description: 'Bank account UUID',
      },
    ],
    put: {
      summary: 'Verify a company bank account',
      operationId: 'put-v1-companies-company_id-bank-accounts-verify',
      tags: ['Company Bank Accounts'],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Bank-Account-Object',
        },
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nVerify a company bank account by confirming the two micro-deposits sent to the bank account. Note that the order of the two deposits specified in request parameters does not matter. There's a maximum of 5 verification attempts, after which we will automatically initiate a new set of micro-deposits and require the bank account to be verified with the new micro-deposits.\n\n### Bank account verification in demo\n\nWe provide the endpoint `POST '/v1/companies/{company_id_or_uuid}/bank_accounts/{bank_account_uuid}/send_test_deposits'` to facilitate bank account verification in the demo environment. This endpoint simulates the micro-deposits transfer and returns them in the reponse. You can call this endpoint as many times as you wish to retrieve the values of the two micro deposits.\n\n```\n  POST '/v1/companies/89771af8-b964-472e-8064-554dfbcb56d9/bank_accounts/ade55e57-4800-4059-9ecd-fa29cfeb6dd2/send_test_deposits'\n\n  {\n    \"deposit_1\": 0.02,\n    \"deposit_2\": 0.42\n  }\n```",
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                deposit_1: {
                  type: 'number',
                  nullable: false,
                  description: 'The dollar amount of the first micro-deposit',
                },
                deposit_2: {
                  type: 'number',
                  nullable: false,
                  description: 'The dollar amount of the second micro-deposit',
                },
              },
            },
            examples: {
              Example: {
                value: {
                  deposit_1: 0.02,
                  deposit_2: 0.42,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/benefits': {
    get: {
      summary: 'Get all benefits supported by Gusto',
      responses: {
        '200': {
          $ref: '#/components/responses/Supported-Benefit-List',
        },
      },
      operationId: 'get-v1-benefits',
      description:
        'Returns all benefits supported by Gusto.\n\nThe benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n\n`scope: benefits.read`',
      tags: ['Benefits'],
    },
  },
  '/v1/benefits/{benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'benefit_id',
        in: 'path',
        required: true,
        description: 'The ID of the benefit',
      },
    ],
    get: {
      operationId: 'get-v1-benefits-benefit_id',
      summary: 'Get a supported benefit by ID',
      description:
        'Returns a benefit supported by Gusto.\n\nThe benefit object in Gusto contains high level information about a particular benefit type and its tax considerations. When companies choose to offer a benefit, they are creating a Company Benefit object associated with a particular benefit.\n\n`scope: benefits.read`',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Supported-Benefit-Object',
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/company_benefits': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get benefits for a company',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-List',
        },
      },
      operationId: 'get-v1-companies-company_id-company_benefits',
      description:
        'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.read`',
    },
    post: {
      summary: 'Create a company benefit',
      tags: ['Benefits'],
      responses: {
        '201': {
          $ref: '#/components/responses/Company-Benefit-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-company_benefits',
      description:
        'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                benefit_id: {
                  type: 'number',
                  description: 'The ID of the benefit to which the company benefit belongs.',
                },
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether this benefit is active for employee participation.',
                },
                description: {
                  type: 'string',
                  description:
                    'The description of the company benefit.For example, a company may offer multiple benefits with an ID of 1 (for Medical Insurance). The description would show something more specific like “Kaiser Permanente” or “Blue Cross/ Blue Shield”.',
                },
                responsible_for_employer_taxes: {
                  type: 'boolean',
                  description:
                    'Whether the employer is subject to pay employer taxes when an employee is on leave. Only applicable to third party sick pay benefits.',
                },
                responsible_for_employee_w2: {
                  type: 'boolean',
                  description:
                    'Whether the employer is subject to file W-2 forms for an employee on leave. Only applicable to third party sick pay benefits.',
                },
              },
              required: ['benefit_id', 'description'],
            },
          },
        },
      },
    },
  },
  '/v1/company_benefits/{company_benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_benefit_id',
        in: 'path',
        required: true,
        description: 'The ID of the company benefit',
      },
    ],
    get: {
      summary: 'Get a company benefit',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-Object',
        },
      },
      operationId: 'get-v1-company_benefits-company_benefit_id',
      description:
        'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits.read`',
    },
    put: {
      summary: 'Update a company benefit',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Company-Benefit-Object',
        },
      },
      operationId: 'put-v1-company_benefits-company_benefit_id',
      description:
        'Company benefits represent the benefits that a company is offering to employees. This ties together a particular supported benefit with the company-specific information for the offering of that benefit.\n\nNote that company benefits can be deactivated only when no employees are enrolled.\n\n`scope: company_benefits:write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                  readOnly: true,
                },
                active: {
                  type: 'boolean',
                  description:
                    'Whether this benefit is active for employee participation. Company benefits may only be deactivated if no employees are actively participating.',
                },
                description: {
                  type: 'string',
                  description:
                    'The description of the company benefit.For example, a company may offer multiple benefits with an ID of 1 (for Medical Insurance). The description would show something more specific like “Kaiser Permanente” or “Blue Cross/ Blue Shield”.',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872',
                  active: false,
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/earning_types': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get all earning types for a company',
      tags: ['Earning Type'],
      responses: {
        '200': {
          $ref: '#/components/responses/Earning-Type-List',
        },
      },
      operationId: 'get-v1-companies-company_id-earning_types',
      description:
        'A payroll item in Gusto is associated to an earning type to name the type of earning described by the payroll item.\n\n#### Default Earning Type\nCertain earning types are special because they have tax considerations. Those earning types are mostly the same for every company depending on its legal structure (LLC, Corporation, etc.)\n\n#### Custom Earning Type\nCustom earning types are all the other earning types added specifically for a company.\n\n`scope: payrolls.read`',
    },
    post: {
      summary: 'Create a custom earning type',
      tags: ['Earning Type'],
      responses: {
        '201': {
          $ref: '#/components/responses/Earning-Type-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-earning_types',
      description:
        'Create a custom earning type.\n\nIf an inactive earning type exists with the same name, this will reactivate it instead of creating a new one.\n\n`scope: payrolls:write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the custom earning type.',
                },
              },
              required: ['name'],
            },
            examples: {
              Example: {
                value: {
                  name: 'Gym Membership Stipend',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/earning_types/{earning_type_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'earning_type_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the earning type',
      },
    ],
    put: {
      summary: 'Update an earning type',
      tags: ['Earning Type'],
      responses: {
        '200': {
          $ref: '#/components/responses/Earning-Type-Object',
        },
      },
      operationId: 'put-v1-companies-company_id-earning_types-earning_type_uuid',
      description: 'Update an earning type.\n\n`scope: payrolls.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the custom earning type.',
                },
              },
            },
            examples: {
              Example: {
                value: {
                  name: 'Gym Membership Stipend',
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Deactivate an earning type',
      tags: ['Earning Type'],
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      operationId: 'delete-v1-companies-company_id-earning_types-earning_type_uuid',
      description: 'Deactivate an earning type.\n\n`scope: payrolls.write`',
    },
  },
  '/v1/employees/{employee_id_or_uuid}/employee_benefits': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    get: {
      summary: "Get an employee's benefits",
      tags: ['Benefits'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-List',
        },
      },
      operationId: 'get-v1-employees-employee_id-employee_benefits',
      description:
        'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\nReturns an array of all employee benefits for this employee\n\n`scope: employee_benefits.read`',
    },
    post: {
      summary: 'Create an employee benefit',
      tags: ['Benefits'],
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Benefit-Object',
        },
      },
      operationId: 'post-v1-employees-employee_id-employee_benefits',
      description:
        'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                company_benefit_id: {
                  type: 'number',
                  description: 'The ID of the company to which the benefit belongs.',
                  readOnly: true,
                },
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether the employee benefit is active.',
                },
                employee_deduction: {
                  type: 'string',
                  default: '0.00',
                  description: "The amount to be deducted, per pay period, from the employee's pay.",
                },
                deduct_as_percentage: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the employee deduction amount should be treated as a percentage to be deducted from each payroll.',
                },
                employee_deduction_annual_maximum: {
                  type: 'string',
                  description: 'The maximum employee deduction amount per year. A null value signifies no limit.',
                  nullable: true,
                },
                contribution: {
                  type: 'object',
                  description: 'An object representing the company contribution type and value.',
                  properties: {
                    type: {
                      type: 'string',
                      description:
                        'The company contribution scheme.\n\n`amount`: The company contributes a fixed amount per payroll. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`percentage`: The company contributes a percentage of the payroll amount per payroll period. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`tiered`: The size of the company contribution corresponds to the size of the employee deduction relative to a tiered matching scheme.',
                      enum: ['tiered', 'percentage', 'amount'],
                    },
                    value: {
                      description:
                        'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.\n\nFor the `tiered` contribution type, an array of tiers.',
                      oneOf: [
                        {
                          type: 'string',
                          description:
                            'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.',
                        },
                        {
                          type: 'array',
                          description: 'For `tiered` contribution types, an array of tiers.',
                          items: {
                            type: 'object',
                            description: 'A single tier of a tiered matching scheme.',
                            properties: {
                              rate: {
                                type: 'string',
                                description:
                                  'The percentage of employee deduction within this tier the company contribution will match.',
                              },
                              threshold: {
                                type: 'string',
                                description:
                                  'The percentage threshold at which this tier ends (inclusive).\n\nFor example, a value of "5" means the company contribution will match employee deductions from the previous tier\'s threshold up to and including 5% of payroll.\n\nIf this is the first tier, a value of "5" means the company contribution will match employee deductions from 0% up to and including 5% of payroll.',
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                elective: {
                  type: 'boolean',
                  description:
                    'Whether the company contribution is elective (aka "matching"). For `tiered`, `elective_amount`, and `elective_percentage` contribution types this is ignored and assumed to be `true`.',
                  default: false,
                },
                company_contribution_annual_maximum: {
                  type: 'string',
                  description: 'The maximum company contribution amount per year. A null value signifies no limit.',
                  nullable: true,
                },
                limit_option: {
                  type: 'string',
                  description:
                    'Some benefits require additional information to determine their limit. For example, for an HSA benefit, the limit option should be either "Family" or "Individual". For a Dependent Care FSA benefit, the limit option should be either "Joint Filing or Single" or "Married and Filing Separately".',
                  nullable: true,
                },
                catch_up: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the employee should use a benefit’s "catch up" rate. Only Roth 401k and 401k benefits use this value for employees over 50.',
                },
                coverage_amount: {
                  type: 'string',
                  description:
                    'The amount that the employee is insured for. Note: company contribution cannot be present if coverage amount is set.',
                  nullable: true,
                },
                coverage_salary_multiplier: {
                  type: 'string',
                  default: '0.00',
                  description:
                    'The coverage amount as a multiple of the employee’s salary. Only applicable for Group Term Life benefits. Note: cannot be set if coverage amount is also set.',
                },
                deduction_reduces_taxable_income: {
                  type: 'string',
                  enum: ['unset', 'reduces_taxable_income', 'does_not_reduce_taxable_income', null],
                  description:
                    'Whether the employee deduction reduces taxable income or not. Only valid for Group Term Life benefits. Note: when the value is not "unset", coverage amount and coverage salary multiplier are ignored.',
                  nullable: true,
                },
                company_contribution: {
                  type: 'string',
                  default: '0.00',
                  description: 'The amount to be paid, per pay period, by the company.',
                  deprecated: true,
                },
                contribute_as_percentage: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the company contribution amount should be treated as a percentage to be deducted from each payroll.',
                  deprecated: true,
                },
              },
              required: ['company_benefit_id'],
            },
            examples: {
              Example: {
                value: {
                  company_benefit_id: 290384923980230,
                  active: true,
                  employee_deduction: '100.00',
                  contribution: {
                    type: 'amount',
                    value: '100.00',
                  },
                },
              },
            },
          },
        },
        description: '',
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/ytd_benefit_amounts_from_different_company': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    post: {
      summary: 'Year-to-date Benefit Amounts from Different Company',
      tags: ['Benefits'],
      operationId: 'post-employee-ytd-benefit-amounts-from-different-company',
      description:
        'Year-to-date benefit amounts from a different company represents the amount of money added to an employees plan during a current year, made outside of the current contribution when they were employed at a different company.\n\n`scope: employee_benefits.write`',
      requestBody: {
        $ref: '#/components/requestBodies/post-employee-ytd-benefit-amounts-from-different-company',
      },
      responses: {
        '204': {
          description: 'No Content',
        },
      },
    },
  },
  '/v1/employee_benefits/{employee_benefit_id}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_benefit_id',
        in: 'path',
        required: true,
        description: 'The ID of the employee benefit',
      },
    ],
    get: {
      summary: 'Get an employee benefit',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-Object',
        },
      },
      operationId: 'get-v1-employee_benefits-employee_benefit_id',
      description:
        'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.read`',
    },
    put: {
      summary: 'Update an employee benefit',
      tags: ['Benefits'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Benefit-Object',
        },
      },
      operationId: 'put-v1-employee_benefits-employee_benefit_id',
      description:
        'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                  readOnly: true,
                },
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether the employee benefit is active.',
                },
                employee_deduction: {
                  type: 'string',
                  default: '0.00',
                  description: "The amount to be deducted, per pay period, from the employee's pay.",
                },
                deduct_as_percentage: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the employee deduction amount should be treated as a percentage to be deducted from each payroll.',
                },
                employee_deduction_annual_maximum: {
                  type: 'string',
                  description: 'The maximum employee deduction amount per year. A null value signifies no limit.',
                  nullable: true,
                },
                contribution: {
                  type: 'object',
                  description: 'An object representing the type and value of the company contribution.',
                  properties: {
                    type: {
                      type: 'string',
                      description:
                        'The company contribution scheme.\n\n`amount`: The company contributes a fixed amount per payroll. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`percentage`: The company contributes a percentage of the payroll amount per payroll period. If elective is true, the contribution is matching, dollar-for-dollar.\n\n`tiered`: The size of the company contribution corresponds to the size of the employee deduction relative to a tiered matching scheme.',
                      enum: ['amount', 'percentage', 'tiered'],
                    },
                    value: {
                      description:
                        'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.\n\nFor the `tiered` contribution type, an array of tiers.',
                      oneOf: [
                        {
                          type: 'string',
                          description:
                            'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.',
                        },
                        {
                          type: 'array',
                          description: 'For `tiered` contribution types, an array of tiers.',
                          items: {
                            type: 'object',
                            description: 'A single tier of a tiered matching scheme.',
                            properties: {
                              rate: {
                                type: 'string',
                                description:
                                  'The percentage of employee deduction within this tier the company contribution will match.',
                              },
                              threshold: {
                                type: 'string',
                                description:
                                  'The percentage threshold at which this tier ends (inclusive).\n\nFor example, a value of "5" means the company contribution will match employee deductions from the previous tier\'s threshold up to and including 5% of payroll.\n\nIf this is the first tier, a value of "5" means the company contribution will match employee deductions from 0% up to and including 5% of payroll.',
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                elective: {
                  type: 'boolean',
                  description:
                    'Whether the company contribution is elective (aka "matching"). For `tiered`, `elective_amount`, and `elective_percentage` contribution types this is ignored and assumed to be `true`.',
                  default: false,
                },
                company_contribution_annual_maximum: {
                  type: 'string',
                  description: 'The maximum company contribution amount per year. A null value signifies no limit.',
                  nullable: true,
                },
                limit_option: {
                  type: 'string',
                  description:
                    'Some benefits require additional information to determine their limit. For example, for an HSA benefit, the limit option should be either "Family" or "Individual". For a Dependent Care FSA benefit, the limit option should be either "Joint Filing or Single" or "Married and Filing Separately".',
                  nullable: true,
                },
                catch_up: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the employee should use a benefit’s "catch up" rate. Only Roth 401k and 401k benefits use this value for employees over 50.',
                },
                coverage_amount: {
                  type: 'string',
                  description:
                    'The amount that the employee is insured for. Note: company contribution cannot be present if coverage amount is set.',
                  nullable: true,
                },
                deduction_reduces_taxable_income: {
                  type: 'string',
                  default: 'unset',
                  enum: ['unset', 'reduces_taxable_income', 'does_not_reduce_taxable_income', null],
                  description:
                    'Whether the employee deduction reduces taxable income or not. Only valid for Group Term Life benefits. Note: when the value is not "unset", coverage amount and coverage salary multiplier are ignored.',
                  nullable: true,
                },
                coverage_salary_multiplier: {
                  type: 'string',
                  default: '0.00',
                  description:
                    'The coverage amount as a multiple of the employee’s salary. Only applicable for Group Term Life benefits. Note: cannot be set if coverage amount is also set.',
                },
                company_contribution: {
                  type: 'string',
                  default: '0.00',
                  description: 'The amount to be paid, per pay period, by the company.',
                  deprecated: true,
                },
                contribute_as_percentage: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Whether the company contribution amount should be treated as a percentage to be deducted from each payroll.',
                  deprecated: true,
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '09j3d29jqdpj92109j9j2d90dq',
                  employee_deduction: '250.00',
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete an employee benefit',
      tags: ['Benefits'],
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      operationId: 'delete-v1-employee_benefits-employee_benefit_id',
      description:
        'Employee benefits represent an employee enrolled in a particular company benefit. It includes information specific to that employee’s enrollment.\n\n`scope: employee_benefits.write`',
    },
  },
  '/v1/companies/{company_id_or_uuid}/pay_periods': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get pay periods for a company',
      tags: ['Payrolls'],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Pay-Period',
                },
              },
              examples: {
                Example: {
                  value: [
                    {
                      start_date: '2020-12-12',
                      end_date: '2020-12-25',
                      pay_schedule_id: 1409756036510222,
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501',
                      eligible_employees: [
                        {
                          id: 1409722316858016,
                          job_ids: [1409722316881160],
                        },
                        {
                          id: 7740244452464965,
                          job_ids: [7740244454306064],
                        },
                        {
                          id: 7757869431131641,
                          job_ids: [7757869439389315],
                        },
                      ],
                      payroll: {
                        processed: true,
                        payroll_deadline: '2020-12-28',
                      },
                    },
                    {
                      start_date: '2020-12-26',
                      end_date: '2021-01-08',
                      pay_schedule_id: 1409756036510222,
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501',
                      eligible_employees: [
                        {
                          id: 1409722316858016,
                          job_ids: [1409722316881160],
                        },
                        {
                          id: 7740244452464965,
                          job_ids: [7740244454306064],
                        },
                        {
                          id: 7757869431131641,
                          job_ids: [7757869439389315],
                        },
                      ],
                      payroll: {
                        processed: true,
                        payroll_deadline: '2021-01-12',
                      },
                    },
                    {
                      start_date: '2021-01-09',
                      end_date: '2021-01-22',
                      pay_schedule_id: 1409756036510222,
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501',
                      eligible_employees: [
                        {
                          id: 1409722316858016,
                          job_ids: [1409722316881160],
                        },
                        {
                          id: 7740244452464965,
                          job_ids: [7740244454306064],
                        },
                      ],
                      payroll: {
                        processed: true,
                        payroll_deadline: '2021-01-26',
                      },
                    },
                    {
                      start_date: '2021-01-23',
                      end_date: '2021-02-05',
                      pay_schedule_id: 1409756036510222,
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501',
                      eligible_employees: [
                        {
                          id: 1409722316858016,
                          job_ids: [1409722316881160],
                        },
                        {
                          id: 7740244452464965,
                          job_ids: [7740244454306064],
                        },
                      ],
                      payroll: {
                        processed: false,
                        payroll_deadline: '2021-02-09',
                      },
                    },
                    {
                      start_date: '2021-02-06',
                      end_date: '2021-02-19',
                      pay_schedule_id: 1409756036510222,
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501',
                      eligible_employees: [
                        {
                          id: 1409722316858016,
                          job_ids: [1409722316881160],
                        },
                        {
                          id: 7740244452464965,
                          job_ids: [7740244454306064],
                        },
                      ],
                      payroll: {
                        processed: false,
                        payroll_deadline: '2021-02-23',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      operationId: 'get-v1-companies-company_id-pay_periods',
      description:
        'Pay periods are the foundation of payroll. Compensation, time & attendance, taxes, and expense reports all rely on when they happened. To begin submitting information for a given payroll, we need to agree on the time period.\n\n\nBy default, this endpoint returns every current and past pay period for a company. Since companies can process payroll as often as every week, there can be up to 53 pay periods a year. If a company has been running payroll with Gusto for five years, this endpoint could return up to 265 pay periods. Use the `start_date` and `end_date` parameters to reduce the scope of the response.\n\n`scope: payrolls.read`',
      parameters: [
        {
          schema: {
            type: 'string',
            example: '2020-01-01',
          },
          in: 'query',
          name: 'start_date',
        },
        {
          schema: {
            type: 'string',
            example: '2020-01-31',
          },
          in: 'query',
          name: 'end_date',
        },
      ],
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the company',
        required: true,
      },
    ],
    get: {
      summary: 'Get all payrolls for a company',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-List',
        },
      },
      operationId: 'get-v1-companies-company_id-payrolls',
      description:
        'Returns all payrolls, current and past for a company.\n\nNotes:\n* Hour and dollar amounts are returned as string representations of numeric decimals.\n* Hours are represented to the thousands place; dollar amounts are represented to the cent.\n* Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n\n`scope: payrolls.read`',
      parameters: [
        {
          schema: {
            type: 'boolean',
          },
          in: 'query',
          name: 'processed',
          description: 'Whether to return processed or unprocessed payrolls',
        },
        {
          schema: {
            type: 'boolean',
          },
          in: 'query',
          name: 'include_off_cycle',
          description: 'Whether to include off cycle payrolls in the response',
        },
        {
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['benefits', 'deductions', 'taxes'],
            },
          },
          in: 'query',
          name: 'include',
          description: 'Include the requested attribute in the employee_compensations attribute in the response',
        },
        {
          schema: {
            type: 'string',
          },
          in: 'query',
          name: 'start_date',
          description: 'Return payrolls whose pay period is after the start date',
        },
        {
          schema: {
            type: 'string',
          },
          in: 'query',
          name: 'end_date',
          description: 'Return payrolls whose pay period is before the end date',
        },
      ],
    },
    post: {
      summary: 'Create an Off-Cycle Payroll',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object',
        },
      },
      operationId: 'post-v1-companies-company_id-payrolls',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates a new, unprocessed, off-cycle payroll.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                off_cycle: {
                  type: 'string',
                },
                off_cycle_reason: {
                  type: 'string',
                  enum: ['Bonus', 'Correction'],
                },
                start_date: {
                  type: 'string',
                },
                end_date: {
                  type: 'string',
                },
                employee_ids: {
                  type: 'array',
                  items: {
                    type: 'integer',
                  },
                },
                check_date: {
                  type: 'string',
                },
              },
              required: ['off_cycle'],
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'payroll_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the payroll ',
      },
    ],
    put: {
      summary: 'Update a payroll by ID',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object',
        },
      },
      operationId: 'put-v1-companies-company_id-payrolls',
      description:
        'This endpoint allows you to update information for one or more employees for a specific **unprocessed** payroll.\n\n`scope: payrolls.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.',
                },
                employee_compensations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    description: '',
                    properties: {
                      employee_id: {
                        type: 'integer',
                        description: 'The ID of the employee. Required unless using employee_uuid.',
                      },
                      employee_uuid: {
                        type: 'string',
                        description: 'The UUID of the employee. Required unless using employee_id.',
                      },
                      excluded: {
                        type: 'boolean',
                        description:
                          'This employee will be excluded from payroll calculation and will not be paid for the payroll.',
                      },
                      fixed_compensations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          description:
                            'An array of fixed compensations for the employee. Fixed compensations include tips, bonuses, and one time reimbursements.',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.',
                            },
                            amount: {
                              type: 'string',
                              description: 'The amount of the compensation for the pay period.',
                            },
                            job_id: {
                              type: 'integer',
                              description: 'The ID of the job for the compensation.',
                            },
                          },
                        },
                      },
                      hourly_compensations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          description:
                            'An array of hourly compensations for the employee. Hourly compensations include regular, overtime, and double overtime hours.',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.',
                            },
                            hours: {
                              type: 'string',
                              description: 'The number of hours to be compensated for this pay period.',
                            },
                            job_id: {
                              type: 'integer',
                              description: 'The ID of the job for the compensation.',
                            },
                          },
                        },
                      },
                      paid_time_off: {
                        type: 'array',
                        description: 'An array of all paid time off the employee is eligible for this pay period.',
                        items: {
                          type: 'object',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the PTO. This also serves as the unique, immutable identifier for the PTO.',
                            },
                            hours: {
                              type: 'string',
                              description: 'The hours of this PTO taken during the pay period.',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              required: ['version', 'employee_compensations'],
            },
            examples: {
              Example: {
                value: {
                  version: '19289df18e6e20f797de4a585ea5a91535c7ddf7',
                  employee_compensations: [
                    {
                      employee_id: 1123581321345589,
                      excluded: false,
                      fixed_compensations: [
                        {
                          name: 'Bonus',
                          amount: '200.00',
                          job_id: 1,
                        },
                      ],
                      hourly_compensations: [
                        {
                          name: 'Regular Hours',
                          hours: '30.000',
                          job_id: 1,
                        },
                        {
                          name: 'Double Overtime',
                          hours: '20.000',
                          job_id: 1,
                        },
                        {
                          name: 'Overtime',
                          hours: '10.000',
                          job_id: 2,
                        },
                      ],
                      paid_time_off: [
                        {
                          name: 'Vacation Hours',
                          hours: '25.000',
                        },
                        {
                          name: 'Sick Hours',
                          hours: '10.000',
                        },
                        {
                          name: 'Holiday Hours',
                          hours: '8.000',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'Get a single payroll',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object',
        },
      },
      operationId: 'get-v1-companies-company_id-payrolls-payroll_id',
      description:
        'Returns a payroll.\n\nNotes:\n* Hour and dollar amounts are returned as string representations of numeric decimals.\n* Hours are represented to the thousands place; dollar amounts are represented to the cent.\n* Every eligible compensation is returned for each employee. If no data has yet be inserted for a given field, it defaults to “0.00” (for fixed amounts) or “0.000” (for hours ).\n\n`scope: payrolls.read`',
      parameters: [
        {
          schema: {
            type: 'string',
            enum: ['benefits', 'deductions', 'taxes'],
          },
          in: 'query',
          name: 'include',
          description: 'Include the requested attribute in the employee_compensations attribute in the response',
        },
        {
          schema: {
            type: 'string',
          },
          in: 'query',
          name: 'show_calculation',
          description:
            'with `include`, shows the tax, and/or benefit, and/or deduction details for a calculated, unprocessed payroll. ',
        },
      ],
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls/{pay_period_start_date}/{pay_period_end_date}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'pay_period_start_date',
        in: 'path',
        required: true,
        description: 'The start_date of the pay period for the payroll',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'pay_period_end_date',
        in: 'path',
        required: true,
        description: 'The end_date of the pay period for the payroll',
      },
    ],
    put: {
      summary: 'Update a payroll',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object',
        },
      },
      operationId: 'put-v1-companies-company_id-payrolls-pay_period_start_date-pay_period_end_date',
      description:
        'This endpoint allows you to update information for one or more employees for a specific **unprocessed** payroll.\n\nThe payrolls are identified by their pay periods’ start_date and end_date. Both are required and must correspond with an existing, unprocessed payroll. *If the dates do not match, the entire request will be rejected.* This was an explicit design decision to remove any assumptions around the timespan for data sent.\n\n`scope: payrolls.write`',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.',
                },
                employee_compensations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    description: '',
                    properties: {
                      employee_id: {
                        type: 'integer',
                        description: 'The ID of the employee. Required unless using employee_uuid.',
                      },
                      employee_uuid: {
                        type: 'string',
                        description: 'The UUID of the employee. Required unless using employee_id.',
                      },
                      excluded: {
                        type: 'boolean',
                        description:
                          'This employee will be excluded from payroll calculation and will not be paid for the payroll.',
                      },
                      fixed_compensations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          description:
                            'An array of fixed compensations for the employee. Fixed compensations include tips, bonuses, and one time reimbursements.',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.',
                            },
                            amount: {
                              type: 'string',
                              description: 'The amount of the compensation for the pay period.',
                            },
                            job_id: {
                              type: 'integer',
                              description: 'The ID of the job for the compensation.',
                            },
                          },
                        },
                      },
                      hourly_compensations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          description:
                            'An array of hourly compensations for the employee. Hourly compensations include regular, overtime, and double overtime hours.',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the compensation. This also serves as the unique, immutable identifier for this compensation.',
                            },
                            hours: {
                              type: 'string',
                              description: 'The number of hours to be compensated for this pay period.',
                            },
                            job_id: {
                              type: 'integer',
                              description: 'The ID of the job for the compensation.',
                            },
                          },
                        },
                      },
                      paid_time_off: {
                        type: 'array',
                        description: 'An array of all paid time off the employee is eligible for this pay period.',
                        items: {
                          type: 'object',
                          properties: {
                            name: {
                              type: 'string',
                              description:
                                'The name of the PTO. This also serves as the unique, immutable identifier for the PTO.',
                            },
                            hours: {
                              type: 'string',
                              description: 'The hours of this PTO taken during the pay period.',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              required: ['version', 'employee_compensations'],
            },
            examples: {
              Example: {
                value: {
                  version: '19289df18e6e20f797de4a585ea5a91535c7ddf7',
                  employee_compensations: [
                    {
                      employee_id: 1123581321345589,
                      excluded: false,
                      fixed_compensations: [
                        {
                          name: 'Bonus',
                          amount: '200.00',
                          job_id: 1,
                        },
                      ],
                      hourly_compensations: [
                        {
                          name: 'Regular Hours',
                          hours: '30.000',
                          job_id: 1,
                        },
                        {
                          name: 'Double overtime',
                          hours: '20.000',
                          job_id: 1,
                        },
                        {
                          name: 'Overtime',
                          hours: '10.000',
                          job_id: 2,
                        },
                      ],
                      paid_time_off: [
                        {
                          name: 'Vacation Hours',
                          hours: '25.000',
                        },
                        {
                          name: 'Sick Hours',
                          hours: '10.000',
                        },
                        {
                          name: 'Holiday Hours',
                          hours: '8.000',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/partner_managed_companies': {
    post: {
      summary: 'Create a partner managed company',
      tags: ['Companies'],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                description: '',
                type: 'object',
                properties: {
                  access_token: {
                    type: 'string',
                    description:
                      'Access token that can be used for OAuth access to the account. Access tokens expire 2 hours after they are issued.',
                    readOnly: true,
                  },
                  refresh_token: {
                    type: 'string',
                    description: 'Refresh token that can be exchanged for a new access token.',
                    readOnly: true,
                  },
                  company_uuid: {
                    type: 'string',
                    description: 'Gusto’s UUID for the company',
                    readOnly: true,
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    access_token: 'de6780bc506a0446309bd9362820ba8aed28aa506c71eedbe1c5c4f9dd350e54',
                    refresh_token: '8257e65c97202ed1726cf9571600918f3bffb2544b26e00a61df9897668c33a1',
                    company_uuid: 'd525dd21-ba6e-482c-be15-c2c7237f1364',
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'post-v1-partner-managed-companies',
      description:
        'This endpoint is intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\n### Overview\n\nThe partner managed company API provides a way to create a Gusto company that you can manage. This endpoint behaves similarly to [creating a company](../~1v1~1provision/post) in that it does the following:\n\n* Creates a new company in Gusto.\n* Creates a new user in Gusto.\n* Makes the new user the primary payroll administrator of the new company.\n\nAdditionally, on successful creation of the company, this API will do the following:\n* Creates a link between the partner and the company.\n* Creates access tokens and refresh tokens that can be used immediately.\n\nIn the response, you will receive the access token, the refresh token, and the uuid of the created company.\n\n### Authentication\n\nDue to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n\n```\nContent-Type: application/json\nAuthorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n```',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  description:
                    'Information for the user who will be the primary payroll administrator for the new company.',
                  required: ['first_name', 'last_name', 'email'],
                  properties: {
                    first_name: {
                      type: 'string',
                      description: 'The first name of the user who will be the primary payroll admin.',
                    },
                    last_name: {
                      type: 'string',
                      description: 'The last name of the user who will be the primary payroll admin.',
                    },
                    email: {
                      type: 'string',
                      description: 'The email of the user who will be the primary payroll admin.',
                    },
                    phone: {
                      type: 'string',
                      description: 'The phone number of the user who will be the primary payroll admin.',
                    },
                  },
                },
                company: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: {
                      type: 'string',
                      description: 'The legal name of the company.',
                    },
                    trade_name: {
                      type: 'string',
                      description: 'The name of the company.',
                    },
                    ein: {
                      type: 'string',
                      description: 'The employer identification number (EIN) of the company.',
                    },
                  },
                },
              },
              required: ['user', 'company'],
            },
            examples: {
              Example: {
                value: {
                  user: {
                    first_name: 'Frank',
                    last_name: 'Ocean',
                    email: 'frank@example.com',
                    phone: '2345558899',
                  },
                  company: {
                    name: "Frank's Ocean, LLC",
                    trade_name: 'Frank’s Ocean',
                    ein: '123456789',
                  },
                },
              },
            },
          },
        },
        description: '',
      },
      security: [],
    },
  },
  '/v1/provision': {
    post: {
      summary: 'Create a company',
      tags: ['Companies'],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                description: '',
                type: 'object',
                properties: {
                  account_claim_url: {
                    type: 'string',
                    description:
                      'A URL where the user should be redirected to complete their account setup inside of Gusto.',
                    readOnly: true,
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    account_claim_url: 'https://app.gusto.com/claim_account/3456789',
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'post-v1-provision',
      description:
        '### Overview\n\nThe company provisioning API provides a way to create a Gusto company as part of your integration. When you successfully call the API, the API does the following:\n\n* Creates a new company in Gusto.\n* Creates a new user in Gusto.\n* Makes the new user the primary payroll administrator of the new company.\n* Sends a welcome email to the new user.\n\nIn the response, you will receive an account claim URL. Redirect the user to this URL to complete their account setup inside of Gusto\n\n### Authentication\n\nDue to the nature of this endpoint, Gusto will provide partners with an API token and will permit partners to use API Token Authentication instead of OAuth to provision Gusto accounts. The API token is included in the authorization HTTP header with the Token scheme, e.g.:\n\n```\nContent-Type: application/json\nAuthorization: Token bbb286ff1a4fe6b84742b0d49b8d0d65bd0208d27d3d50333591df71\n```',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  description:
                    'Information for the user who will be the primary payroll administrator for the new company.',
                  required: ['first_name', 'last_name', 'email'],
                  properties: {
                    first_name: {
                      type: 'string',
                      description: 'The first name of the user who will be the primary payroll admin.',
                    },
                    last_name: {
                      type: 'string',
                      description: 'The last name of the user who will be the primary payroll admin.',
                    },
                    email: {
                      type: 'string',
                      description: 'The email of the user who will be the primary payroll admin.',
                    },
                    phone: {
                      type: 'string',
                      description: 'The phone number of the user who will be the primary payroll admin.',
                    },
                  },
                },
                company: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: {
                      type: 'string',
                      description: 'The legal name of the company.',
                    },
                    trade_name: {
                      type: 'string',
                      description: 'The name of the company.',
                    },
                    ein: {
                      type: 'string',
                      description: 'The employer identification number (EIN) of the company.',
                    },
                    states: {
                      type: 'array',
                      description:
                        'The states in which the company operates. States should be included by their two letter code, i.e. NY for New York. ',
                      items: {
                        type: 'string',
                      },
                    },
                    number_employees: {
                      type: 'number',
                      description: 'The number of employees in the company.',
                    },
                    addresses: {
                      type: 'array',
                      uniqueItems: false,
                      description: 'The locations for the company. This includes mailing, work, and filing addresses.',
                      items: {
                        type: 'object',
                        properties: {
                          street_1: {
                            type: 'string',
                          },
                          street_2: {
                            type: 'string',
                            nullable: true,
                          },
                          city: {
                            type: 'string',
                          },
                          zip: {
                            type: 'string',
                          },
                          state: {
                            type: 'string',
                          },
                          phone: {
                            type: 'string',
                          },
                          is_primary: {
                            type: 'string',
                            description:
                              'Whether or not this is a primary address for the company. If set to true, the address will be used as the mailing and filing address for the company and will be added as a work location. If set to false or not included, the address will only be added as a work location for the company. If multiple addresses are included, only one should be marked as primary.',
                          },
                        },
                      },
                    },
                  },
                },
              },
              required: ['user', 'company'],
            },
            examples: {
              Example: {
                value: {
                  user: {
                    first_name: 'Frank',
                    last_name: 'Ocean',
                    email: 'frank@example.com',
                    phone: '2345558899',
                  },
                  company: {
                    name: "Frank's Ocean, LLC",
                    trade_name: 'Frank’s Ocean',
                    tier: 'complete',
                    ein: '123456789',
                    states: ['CO', 'CA'],
                    number_employees: 8,
                    addresses: [
                      {
                        street_1: '1201 16th Street Mall',
                        street_2: 'Suite 350',
                        city: 'Denver',
                        zip: '80202',
                        state: 'CO',
                        phone: '2345678900',
                        is_primary: 'true',
                      },
                      {
                        street_1: '525 20th Street',
                        city: 'San Francisco',
                        zip: '94107',
                        state: 'CA',
                        phone: '2345678901',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        description: '',
      },
      security: [],
    },
  },
  '/v1/employees/{employee_id_or_uuid}/custom_fields': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the employee',
      },
    ],
    get: {
      summary: "Get an employee's custom fields",
      tags: ['Custom Fields'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  custom_fields: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Employee-Custom-Field',
                    },
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    custom_fields: [
                      {
                        id: 'ee515986-f3ca-49da-b576-2691b95262f9',
                        company_custom_field_id: 'ea7e5d57-6abb-47d7-b654-347c142886c0',
                        name: 'employee_level',
                        description: 'Employee Level',
                        type: 'text',
                        value: '2',
                        selection_options: null,
                      },
                      {
                        id: '3796e08d-c2e3-434c-b4de-4ce1893e7b59',
                        company_custom_field_id: '299650e4-e970-4acf-9bf0-6f05585d20ba',
                        name: 't-shirt size',
                        description: 'What is your t-shirt size?',
                        type: 'text',
                        value: 'md',
                        selection_options: null,
                      },
                      {
                        id: '3796e08d-c2e3-434c-b4de-4ce1893e7b59',
                        company_custom_field_id: '024ec137-6c92-43a3-b061-14a9720531d6',
                        name: 'favorite fruit',
                        description: 'Which is your favorite fruit?',
                        type: 'radio',
                        value: 'apple',
                        selection_options: ['apple', 'banana', 'orange'],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'get-v1-employees-employee_id-custom_fields',
      description: "Returns a list of the employee's custom fields.\n\n`scope: employees.read`",
    },
  },
  '/v1/companies/{company_id_or_uuid}/custom_fields': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the company',
      },
    ],
    get: {
      summary: 'Get the custom fields of a company',
      description:
        'Returns a list of the custom fields of the company. Useful when you need to know the schema of custom fields for an entire company\n\n`scope: companies.read`',
      operationId: 'get-v1-companies-company_id-custom_fields',
      tags: ['Custom Fields'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  custom_fields: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Company-Custom-Field',
                    },
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    custom_fields: [
                      {
                        id: 'ea7e5d57-6abb-47d7-b654-347c142886c0',
                        name: 'employee_level',
                        description: 'Employee Level',
                        type: 'text',
                        selection_options: null,
                      },
                      {
                        id: '299650e4-e970-4acf-9bf0-6f05585d20ba',
                        name: 't-shirt size',
                        description: 'What is your t-shirt size?',
                        type: 'text',
                        selection_options: null,
                      },
                      {
                        id: '024ec137-6c92-43a3-b061-14a9720531d6',
                        name: 'favorite fruit',
                        description: 'Which is your favorite fruit?',
                        type: 'radio',
                        selection_options: ['apple', 'banana', 'orange'],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/time_off_requests/{time_off_request_id}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID or ID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'time_off_request_id',
        in: 'path',
        required: true,
        description: 'The ID or UUID of the time off request',
      },
    ],
    get: {
      summary: 'Get a specific time off request',
      tags: ['Time Off Requests'],
      responses: {
        '200': {
          $ref: '#/components/responses/Time-Off-Request-Object',
        },
      },
      operationId: 'get-v1-companies-company_id-time_off_requests-time_off_request_id',
      description: 'Details of a single time off request\n\n`scope: time_off_requests.read`',
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/calculate': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'payroll_id_or_uuid',
        in: 'path',
        required: true,
      },
    ],
    put: {
      summary: 'Calculate a Payroll',
      tags: ['Payrolls'],
      responses: {
        '202': {
          description: 'Accepted',
        },
      },
      operationId: 'put-v1-companies-company_id-payrolls-payroll_id-calculate',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nPerforms calculations for taxes, benefits, and deductions for an unprocessed payroll. The calculated payroll details provide a preview of the actual values that will be used when the payroll is run.\n\nThis calculation is asynchronous and a sucessful request responds with a 202 HTTP status. To view the details of the calculated payroll, use the GET /v1/companies/{company_id}/payrolls/{payroll_id} endpoint with the *show_calculation=true* and *include=taxes,benefits,deductions* params.\n\nIf the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n\n```\n{ "errors": { "missing_requirements": ["needs_onboarding", "invalid_signatory"] } }\n```',
      parameters: [],
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/submit': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'Company ID or UUID',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'payroll_id_or_uuid',
        in: 'path',
        required: true,
        description: 'Payroll ID or UUID',
      },
    ],
    put: {
      summary: 'Submit Payroll',
      tags: ['Payrolls'],
      responses: {
        '202': {
          description: 'Accepted',
        },
      },
      operationId: 'put-v1-companies-company_id-payrolls-payroll_id-submit',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSubmits an unprocessed payroll to be calculated and run. This submission is asynchronous and a sucessful request responds with a 202 HTTP status. Upon success, transitions the payroll to the `processed` state.\n\nIf the company is blocked from running payroll due to issues like incomplete setup, missing information or other compliance issues, the response will be 422 Unprocessable Entity with a categorization of the blockers in the form:\n\n```\n{ "errors": { "missing_requirements": ["needs_onboarding", "invalid_signatory"] } }\n```',
    },
  },
  '/v1/companies/{company_id_or_uuid}/payrolls/{payroll_id_or_uuid}/cancel': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'Company ID or UUID',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'payroll_id_or_uuid',
        in: 'path',
        required: true,
        description: 'Payroll ID or UUID',
      },
    ],
    put: {
      summary: 'Cancel a Payroll',
      tags: ['Payrolls'],
      responses: {
        '200': {
          $ref: '#/components/responses/Payroll-Object',
        },
      },
      operationId: 'put-api-v1-companies-company_id-payrolls-payroll_id-cancel',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nTransitions a `processed` payroll back to the `unprocessed` state. A payroll cannot be canceled once it has entered the `funded` state.\n',
    },
  },
  '/v1/companies/{company_id_or_uuid}/payroll_reversals': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
      },
    ],
    get: {
      summary: 'Get approved Payroll Reversals',
      tags: ['Payrolls'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reversed_payroll_id: {
                    type: 'integer',
                    description: 'The payroll run being reversed.',
                  },
                  reversal_payroll_id: {
                    type: 'integer',
                    description: 'The payroll where the reversal was applied.',
                  },
                  reason: {
                    type: 'string',
                    description: 'A reason provided by the admin who created the reversal.',
                  },
                  approved_at: {
                    type: 'string',
                    description: 'Timestamp of when the reversal was approved.',
                    nullable: true,
                  },
                  category: {
                    type: 'string',
                    description: 'Category chosen by the admin who requested the reversal.',
                  },
                  reversed_employee_ids: {
                    type: 'array',
                    description: 'Array of employee ids affected.',
                    items: {
                      type: 'integer',
                    },
                  },
                },
              },
              examples: {
                'Successful Response': {
                  value: {
                    reversed_payroll_id: 3,
                    reversal_payroll_id: 5,
                    reason: 'Customer Request',
                    approved_at: null,
                    category: 'convert_check_ee_requested',
                    reversed_employee_ids: [3],
                  },
                },
              },
            },
          },
        },
      },
      operationId: 'get-v1-companies-company_id_or_uuid-payroll_reversals',
      description: 'Returns all approved Payroll Reversals for a Company.\n\n`scope: payrolls.read`',
    },
  },
  '/v1/companies/{company_id_or_uuid}/admins': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The ID of the company',
      },
    ],
    get: {
      summary: 'Get all the admins at a company',
      tags: ['Admins'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      operationId: 'get-v1-companies-company_id-admins',
      responses: {
        '200': {
          $ref: '#/components/responses/Admin-List',
        },
      },
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns a list of all the admins at a company',
    },
    post: {
      summary: 'Create an admin for the company.',
      tags: ['Admins'],
      operationId: 'post-v1-companies-company_id-admins',
      responses: {
        '200': {
          $ref: '#/components/responses/Admin-Object',
        },
      },
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates a new admin for a company. If the email matches an existing user, this will create an admin account for the current user. Otherwise, this will create a new user.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                first_name: {
                  type: 'string',
                  description: 'The first name of the admin.',
                },
                last_name: {
                  type: 'string',
                  description: 'The last name of the admin.',
                },
                email: {
                  type: 'string',
                  description:
                    'The email of the admin. This will be used for the admin to log in to their account. If the email matches an existing user, this will create an admin account for them.',
                },
              },
              required: ['first_name', 'last_name', 'email'],
            },
            examples: {
              Example: {
                value: {
                  first_name: 'John',
                  last_name: 'Smith',
                  email: 'jsmith99@gmail.com',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_id_or_uuid}/federal_tax_details': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The company id or uuid',
      },
    ],
    get: {
      summary: 'Get Federal Tax Details',
      responses: {
        '200': {
          $ref: '#/components/responses/Federal-Tax-Details-Object',
        },
      },
      operationId: 'get-v1-companies-company_id_or_uuid-federal_tax_details',
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nFetches attributes relevant for a company's federal taxes.",
      parameters: [],
      security: [
        {
          Authorization: [],
        },
      ],
      tags: ['Federal Tax Details'],
    },
    put: {
      summary: 'Update Federal Tax Details',
      responses: {
        '200': {
          $ref: '#/components/responses/Federal-Tax-Details-Object',
        },
      },
      operationId: 'put-v1-companies-company_id_or_uuid-federal_tax_details',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                legal_name: {
                  type: 'string',
                  description: 'The legal name of the company',
                },
                ein: {
                  type: 'string',
                  description: 'The EIN of of the company',
                },
                tax_payer_type: {
                  type: 'string',
                  description: 'What type of tax entity the company is',
                },
                filing_form: {
                  type: 'string',
                  description:
                    'The form used by the company for federal tax filing. One of:\n- 941 (Quarterly federal tax return)\n- 944 (Annual federal tax return)',
                },
                taxable_as_scorp: {
                  type: 'boolean',
                  description: 'Whether this company should be taxed as an S-Corporation',
                },
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.',
                },
              },
              required: ['version'],
            },
            examples: {
              Example: {
                value: {
                  version: '6cb95e00540706ca48d4577b3c839fbe',
                  tax_payer_type: 'LLP',
                  taxable_as_scorp: false,
                  filing_form: '944',
                  has_ein: true,
                  ein_verified: false,
                  legal_name: 'Acme Corp.',
                },
              },
            },
          },
        },
        description: 'Attributes related to federal tax details that can be updated via this endpoint include:',
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdates attributes relevant for a company's federal taxes. This information is required is to onboard a company for use with Gusto Embedded Payroll.",
      tags: ['Federal Tax Details'],
    },
  },
  '/v1/employees/{employee_id_or_uuid}/bank_accounts': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
      },
    ],
    get: {
      summary: 'Get all employee bank accounts',
      tags: ['Employee Bank Accounts'],
      parameters: [
        {
          $ref: '#/components/parameters/pageParam',
        },
        {
          $ref: '#/components/parameters/perParam',
        },
      ],
      operationId: 'get-v1-employees-employee_id-bank_accounts',
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns all employee bank accounts.',
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Bank-Account-List',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {},
            },
          },
        },
      },
    },
    post: {
      summary: 'Create an employee bank account',
      operationId: 'post-v1-employees-employee_id-bank_accounts',
      responses: {
        '201': {
          $ref: '#/components/responses/Employee-Bank-Account-Object',
        },
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreates an employee bank account. An employee can have multiple bank accounts. Note that creating an employee bank account will also update the employee's payment method.",
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
                routing_number: {
                  type: 'string',
                },
                account_number: {
                  type: 'string',
                },
                account_type: {
                  type: 'string',
                  enum: ['Checking', 'Savings'],
                },
              },
              required: ['name', 'routing_number', 'account_number', 'account_type'],
            },
            examples: {
              Example: {
                value: {
                  name: 'BoA Checking Account',
                  routing_number: '266905059',
                  account_number: '5809431207',
                  account_type: 'Checking',
                },
              },
            },
          },
        },
      },
      tags: ['Employee Bank Accounts'],
    },
  },
  '/v1/employees/{employee_id_or_uuid}/bank_accounts/{bank_account_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'bank_account_uuid',
        in: 'path',
        required: true,
      },
    ],
    delete: {
      summary: 'Delete an employee bank account',
      operationId: 'delete-v1-employees-employee_id-bank_accounts-bank_account_id',
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nDeletes an employee bank account. To update an employee's bank account details, delete the bank account first and create a new one.",
      tags: ['Employee Bank Accounts'],
    },
  },
  '/v1/employees/{employee_id_or_uuid}/payment_method': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
      },
    ],
    get: {
      summary: "Get an employee's payment method",
      tags: ['Employee Payment Method'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Payment-Method-Object',
        },
      },
      operationId: 'get-v1-employees-employee_id-payment_method',
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nFetches an employee's payment method. An employee payment method describes how the payment should be split across the employee's associated bank accounts.",
    },
    put: {
      summary: "Update an employee's payment method",
      tags: ['Employee Payment Method'],
      operationId: 'put-v1-employees-employee_id-payment_method',
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Payment-Method-Object',
        },
      },
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdates an employee's payment method. Note that creating an employee bank account will also update the employee's payment method.",
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.',
                },
                type: {
                  type: 'string',
                  enum: ['Direct Deposit', 'Check'],
                  description:
                    'The payment method type. If type is Check, then split_by and splits do not need to be populated. If type is Direct Deposit, split_by and splits are required.',
                },
                split_by: {
                  type: 'string',
                  enum: ['Amount', 'Percentage'],
                  description:
                    'Describes how the payment will be split. If split_by is Percentage, then the split amounts must add up to exactly 100. If split_by is Amount, then the last split amount must be nil to capture the remainder.',
                },
                splits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      uuid: {
                        type: 'string',
                        description: 'The bank account ID\n',
                      },
                      name: {
                        type: 'string',
                        description: 'The bank account name',
                      },
                      priority: {
                        description:
                          'The order of priority for each payment split, with priority 1 being the first bank account paid. Priority must be unique and sequential.',
                        type: 'integer',
                      },
                      split_amount: {
                        description: 'The cents amount allocated for each payment split',
                        type: 'integer',
                        nullable: true,
                      },
                    },
                  },
                },
              },
              required: ['version', 'type'],
            },
            examples: {
              'example-1': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed',
                  type: 'Direct Deposit',
                  split_by: 'Amount',
                  splits: [
                    {
                      uuid: 'e88f9436-b74e-49a8-87e9-777b9bfe715e',
                      name: 'BoA Checking Account',
                      priority: 1,
                      split_amount: 500,
                    },
                    {
                      uuid: '0d2b7f73-05d6-4184-911d-269edeecc30a',
                      name: 'Chase Checking Account',
                      priority: 2,
                      split_amount: 1000,
                    },
                    {
                      uuid: '1531e824-8d9e-4bd8-9f90-0d04608125d7',
                      name: 'US Bank Checking Account',
                      priority: 3,
                      split_amount: null,
                    },
                  ],
                },
              },
              'example-2': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed',
                  type: 'Direct Deposit',
                  split_by: 'Percentage',
                  splits: [
                    {
                      uuid: 'e88f9436-b74e-49a8-87e9-777b9bfe715e',
                      name: 'BoA Checking Account',
                      priority: 1,
                      split_amount: 60,
                    },
                    {
                      uuid: '0d2b7f73-05d6-4184-911d-269edeecc30a',
                      name: 'Chase Checking Account',
                      priority: 2,
                      split_amount: 40,
                    },
                  ],
                },
              },
              'example-3': {
                value: {
                  version: '63859768485e218ccf8a449bb60f14ed',
                  type: 'Check',
                },
              },
            },
          },
        },
        description: '',
      },
    },
  },
  '/v1/companies/{company_uuid}/signatories': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        description: 'The UUID of the company',
        required: true,
      },
    ],
    post: {
      summary: 'Create a signatory',
      tags: ['Signatories'],
      operationId: 'post-v1-company-signatories',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreate a company signatory with complete information. A signatory can legally sign forms once the identity verification process is successful.',
      responses: {
        '201': {
          $ref: '#/components/responses/Signatory-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: '',
              properties: {
                ssn: {
                  type: 'string',
                },
                first_name: {
                  type: 'string',
                },
                middle_initial: {
                  type: 'string',
                },
                last_name: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
                title: {
                  type: 'string',
                },
                phone: {
                  type: 'string',
                },
                birthday: {
                  type: 'string',
                },
                home_address: {
                  type: 'object',
                  description: "The signatory's home address",
                  properties: {
                    street_1: {
                      type: 'string',
                    },
                    street_2: {
                      type: 'string',
                    },
                    city: {
                      type: 'string',
                    },
                    state: {
                      type: 'string',
                    },
                    zip: {
                      type: 'string',
                    },
                  },
                  required: ['street_1', 'city', 'state', 'zip'],
                },
              },
              required: ['ssn', 'first_name', 'last_name', 'email', 'title', 'birthday', 'home_address'],
            },
          },
        },
      },
    },
    get: {
      summary: 'Get all company signatories',
      responses: {
        '200': {
          $ref: '#/components/responses/Signatory-List',
        },
      },
      operationId: 'get-v1-companies-company_uuid-signatories',
      description:
        'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nReturns company signatories. Currently we only support a single signatory per company.',
      tags: ['Signatories'],
    },
  },
  '/v1/companies/{company_id_or_uuid}/forms': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the company',
        required: true,
      },
    ],
    get: {
      summary: 'Get all company forms',
      tags: ['Forms'],
      operationId: 'get-v1-company-forms',
      parameters: [],
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a list of all company's forms",
      responses: {
        '200': {
          $ref: '#/components/responses/Form-List',
        },
      },
    },
  },
  '/v1/forms/{id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    get: {
      summary: 'Get a company form',
      tags: ['Forms'],
      operationId: 'get-v1-company-form',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a company form',
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object',
        },
      },
    },
  },
  '/v1/forms/{id_or_uuid}/pdf': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    get: {
      summary: 'Get a form pdf',
      tags: ['Forms'],
      operationId: 'get-v1-company-form-pdf',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet the link to the form PDF',
      responses: {
        '200': {
          description: 'Example response',
          content: {
            'application/json': {
              schema: {
                title: 'Form PDF',
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'the UUID of the form',
                    readOnly: true,
                  },
                  document_url: {
                    type: 'string',
                    description: 'the URL of the form',
                    readOnly: true,
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408',
                    document_url:
                      'https://app.gusto-demo.com/assets/forms/7757842065202782/original/company_direct_deposit20211007-48226-gsqo8k.pdf?1633667020',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/forms/{id_or_uuid}/sign': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    put: {
      summary: 'Sign a company form',
      tags: ['Forms'],
      operationId: 'put-v1-company-form-sign',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSign a company form',
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                signature_text: {
                  type: 'string',
                  description: 'The signature',
                },
                agree: {
                  type: 'boolean',
                  description: 'whether you agree to sign electronically',
                },
                signed_by_ip_address: {
                  type: 'string',
                  description: 'The IP address of the signatory who signed the form.',
                },
              },
              required: ['signature_text', 'agree', 'signed_by_ip_address'],
            },
            examples: {
              Example: {
                value: {
                  signature_text: 'Jane Smith',
                  agree: true,
                  signed_by_ip_address: '192.168.0.1',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/forms': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the employee',
        required: true,
      },
    ],
    get: {
      summary: 'Get all employee forms',
      tags: ['Forms'],
      operationId: 'get-v1-employee-forms',
      parameters: [],
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet a list of all employee's forms",
      responses: {
        '200': {
          $ref: '#/components/responses/Form-List',
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the employee',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    get: {
      summary: 'Get an employee form',
      tags: ['Forms'],
      operationId: 'get-v1-employee-form',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet an employee form',
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object',
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}/pdf': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the employee',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    get: {
      summary: "Get the PDF of an employee's form",
      tags: ['Forms'],
      operationId: 'get-v1-employee-form-pdf',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet the link to the form PDF',
      responses: {
        '200': {
          description: 'Example response',
          content: {
            'application/json': {
              schema: {
                title: 'Form PDF',
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'the UUID of the form',
                    readOnly: true,
                  },
                  document_url: {
                    type: 'string',
                    description: 'the URL of the form',
                    readOnly: true,
                  },
                },
              },
              examples: {
                Example: {
                  value: {
                    uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408',
                    document_url:
                      'https://app.gusto-demo.com/assets/forms/7757842065202782/original/company_direct_deposit20211007-48226-gsqo8k.pdf?1633667020',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/employees/{employee_id_or_uuid}/forms/{id_or_uuid}/sign': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the employee',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'id_or_uuid',
        in: 'path',
        description: 'The ID or UUID of the form',
        required: true,
      },
    ],
    put: {
      summary: 'Sign an employee form',
      tags: ['Forms'],
      operationId: 'put-v1-employee-form-sign',
      parameters: [],
      description:
        'This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nSign a company form',
      responses: {
        '200': {
          $ref: '#/components/responses/Form-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              description: '',
              type: 'object',
              properties: {
                signature_text: {
                  type: 'string',
                  description: 'The signature',
                },
                agree: {
                  type: 'boolean',
                  description: 'whether you agree to sign electronically',
                },
                signed_by_ip_address: {
                  type: 'string',
                  description: 'The IP address of the signatory who signed the form.',
                },
              },
              required: ['signature_text', 'agree', 'signed_by_ip_address'],
            },
            examples: {
              Example: {
                value: {
                  signature_text: 'Jane Smith',
                  agree: true,
                  signed_by_ip_address: '192.168.0.1',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/companies/{company_uuid}/flows': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        description: 'The UUID of the company',
        required: true,
      },
    ],
    post: {
      summary: 'Create a flow',
      tags: ['Flows'],
      operationId: 'post-v1-company-flows',
      parameters: [],
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGenerate a link to access a pre-built workflow in Gusto whitelabel UI. For security, all generated flows will expire within 1 hour of inactivity. Additionally, flows will be deactivated 24 hours from creation time. We currently support the following flow types\n|   |   |   |   |\n|---|---|---|---|\n|__flow_type__|__entity_type__|__entity_uuid__|__Flow description__|\n| **company_onboarding** | n/a | n/a | Full company onboarding flow |\n| **add_addresses** | n/a | n/a | Manage company's work, mailing, and filing addresses |\n| **federal_tax_setup** | n/a | n/a | Review and update company federal tax details |\n| **select_industry** | n/a | n/a | Select the company industry |\n| **add_bank_info** | n/a | n/a | Add bank info manually or via Plaid |\n| **verify_bank_info** | n/a | n/a | Bank deposits verification |\n| **add_employees** | n/a | n/a | Manage all employee onboarding |\n| **state_setup** | n/a | n/a | Review and update company state taxes |\n| **payroll_schedule** | n/a | n/a | Set company's payroll schedule |\n| **sign_all_forms** | n/a | n/a | Add signatory and sign company documents |\n| **employee_form_signing** | 'Employee' | employee's UUID | For employee to review and sign documents |",
      responses: {
        '201': {
          $ref: '#/components/responses/Flow-Object',
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                flow_type: {
                  type: 'string',
                  description: 'flow type',
                },
                entity_uuid: {
                  type: 'string',
                  description:
                    'UUID of the target entity applicable to the flow. This field is optional for company flows, please refer to the flow_types table above for more details.',
                },
                entity_type: {
                  type: 'string',
                  description:
                    'the type of target entity applicable to the flow. This field is optional for company flows, please refer to the flow_types table above for more details.',
                  enum: ['Company'],
                },
              },
              required: ['flow_type'],
            },
            examples: {
              Example: {
                value: {
                  flow_type: 'company_onboarding',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/payrolls/{payroll_id_or_uuid}/employees/{employee_id_or_uuid}/pay_stub': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'payroll_id_or_uuid',
        in: 'path',
        required: true,
      },
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
      },
    ],
    get: {
      summary: 'Get an employee pay stub (pdf)',
      tags: ['Payrolls'],
      operationId: 'get-v1-payrolls-payroll_uuid-employees-employee_uuid-pay_stub',
      description:
        "This endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nGet an employee's pay stub for the specified payroll. By default, an application/pdf response will be returned. No other content types are currently supported, but may be supported in the future.\n\nscope: `payrolls:run`",
      parameters: [],
      responses: {
        '200': {
          description: 'OK',
        },
      },
    },
  },
  '/v1/companies/{company_uuid}/signatories/invite': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        required: true,
      },
    ],
    post: {
      summary: 'Invite a signatory',
      responses: {
        '201': {
          $ref: '#/components/responses/Signatory-Object',
        },
      },
      operationId: 'post-v1-companies-company_uuid-signatories-invite',
      description:
        'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nCreate a signatory with minimal information. This signatory can be invited to provide more information through the `PUT /v1/companies/{company_uuid}/signatories/{signatory_uuid}` endpoint. This will start the identity verification process and allow the signatory to be verified to sign documents.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                first_name: {
                  type: 'string',
                },
                last_name: {
                  type: 'string',
                },
                title: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
              },
              required: ['email'],
            },
          },
        },
      },
      tags: ['Signatories'],
    },
  },
  '/v1/companies/{company_uuid}/signatories/{signatory_uuid}': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'company_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the company',
      },
      {
        schema: {
          type: 'string',
        },
        name: 'signatory_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the signatory',
      },
    ],
    put: {
      summary: 'Update a signatory',
      responses: {
        '200': {
          $ref: '#/components/responses/Signatory-Object',
        },
      },
      operationId: 'put-v1-companies-company_uuid-signatories-signatory_uuid',
      description:
        'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nUpdate a signatory that has been either invited or created. If the signatory has been created with minimal information through the `POST /v1/companies/{company_uuid}/signatories/invite` endpoint, then the first update must contain all attributes specified in the request body in order to start the identity verification process.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  description:
                    'The current version of the object. See the versioning guide for information on how to use this field.',
                },
                first_name: {
                  type: 'string',
                },
                middle_initial: {
                  type: 'string',
                },
                last_name: {
                  type: 'string',
                },
                title: {
                  type: 'string',
                },
                phone: {
                  type: 'string',
                },
                birthday: {
                  type: 'string',
                },
                ssn: {
                  type: 'string',
                },
                home_address: {
                  type: 'object',
                  properties: {
                    street_1: {
                      type: 'string',
                    },
                    street_2: {
                      type: 'string',
                    },
                    city: {
                      type: 'string',
                    },
                    state: {
                      type: 'string',
                    },
                    zip: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
      tags: ['Signatories'],
    },
    delete: {
      summary: 'Delete a signatory',
      operationId: 'delete-v1-companies-company_uuid-signatories-signatory_uuid',
      responses: {
        '204': {
          description: 'No Content',
        },
      },
      description:
        'This endpoint is in beta and intended for Gusto Embedded Payroll customers. Please apply for early access if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n\nDelete a company signatory.',
      tags: ['Signatories'],
    },
  },
  '/v1/employees/{employee_id_or_uuid}/onboarding_status': {
    parameters: [
      {
        schema: {
          type: 'string',
        },
        name: 'employee_id_or_uuid',
        in: 'path',
        required: true,
        description: 'The UUID of the employee',
      },
    ],
    get: {
      summary: "Get the employee's onboarding status (Beta)",
      tags: ['Employees'],
      responses: {
        '200': {
          $ref: '#/components/responses/Employee-Onboarding-Status-Object',
        },
      },
      operationId: 'get-v1-employees-employee_id_or_uuid-onboarding_status',
      description:
        "# Description\nRetrieves an employee's onboarding status. The data returned helps inform the required onboarding steps and respective completion status.\n\n## Beta Endpoint\nThis endpoint is in beta and intended for **[Gusto Embedded Payroll](https://gusto.com/embedded-payroll)** customers. Please [apply for early access](https://gusto-embedded-payroll.typeform.com/to/iomAQIj3?utm_source=docs) if you’d like to learn more and use it for production. Note, this endpoint will require you to enter a different agreement with Gusto.\n",
    },
  },
} as TPaths;
