// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      url: 'https://api.gusto-demo.com';
      description: 'Demo';
    },
    {
      description: 'Production';
      url: 'https://api.gusto.com';
    },
  ];
  paths: {
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
  components: {
    parameters: {
      pageParam: {
        schema: {
          type: 'number';
        };
        in: 'query';
        name: 'page';
        description: 'The page that is requested. When unspecified, will load all employees.';
      };
      perParam: {
        schema: {
          type: 'number';
        };
        in: 'query';
        name: 'per';
        description: 'Number of employees per page. When unspecified, will default to 25';
      };
    };
    schemas: {
      Employee: {
        title: 'Employee';
        type: 'object';
        description: 'The representation of an employee in Gusto.';
        'x-examples': {
          Example: {
            id: 7757869432666660;
            uuid: '9779767c-6044-48e0-bf68-aeb370b9a2e7';
            first_name: 'Nicole';
            middle_initial: 'M';
            last_name: 'Boehm';
            email: 'kory7757869450111548@barton-hermiston.io';
            company_id: 7756341740978008;
            company_uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
            manager_id: 7757869432666662;
            version: '414dedaca594b77135e0b8d2f398516d';
            department: null;
            terminated: false;
            two_percent_shareholder: false;
            onboarded: true;
            jobs: [
              {
                id: 7757869441037999;
                version: '91179081a7309c9fbd31bb3cf7b9893e';
                employee_id: 7757869432666660;
                current_compensation_id: 7757869444844980;
                payment_unit: 'Hour';
                primary: true;
                title: 'Client Support Manager';
                compensations: [
                  {
                    id: 7757869444844980;
                    version: '233f0096a8015e62d9795fadf1fd300d';
                    payment_unit: 'Hour';
                    flsa_status: 'Nonexempt';
                    job_id: 7757869441037999;
                    effective_date: '2021-01-20';
                    rate: '22.00';
                  },
                ];
                rate: '22.00';
                hire_date: '2020-01-20';
                location_id: 7757727716657803;
                location: {
                  id: 7757727716657803;
                  street_1: '412 Kiera Stravenue';
                  street_2: 'Suite 391';
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                  country: 'USA';
                  inactive: false;
                };
              },
            ];
            eligible_paid_time_off: [
              {
                name: 'Sick Hours';
                accrual_unit: 'Hour';
                accrual_rate: '208.0';
                accrual_period: 'Year';
                accrual_balance: '71.0';
                maximum_accrual_balance: '240.0';
                paid_at_termination: false;
              },
              {
                name: 'Vacation Hours';
                accrual_unit: 'Hour';
                accrual_rate: '208.0';
                accrual_period: 'Year';
                accrual_balance: '34.0';
                maximum_accrual_balance: '240.0';
                paid_at_termination: true;
              },
            ];
            terminations: [];
            home_address: {
              version: '7776defce07496b82f3f1ed469e48ae5';
              employee_id: 7757869432666660;
              street_1: '3772 Reynolds Centers';
              street_2: 'Suite 461';
              city: 'San Francisco';
              state: 'CA';
              zip: '94107';
              country: 'USA';
              active: true;
            };
            custom_fields: [
              {
                id: 'ee515986-f3ca-49da-b576-2691b95262f9';
                company_custom_field_id: 'ea7e5d57-6abb-47d7-b654-347c142886c0';
                name: 'employee_level';
                description: 'Employee Level';
                type: 'text';
                value: '2';
              },
              {
                id: '3796e08d-c2e3-434c-b4de-4ce1893e7b59';
                company_custom_field_id: '299650e4-e970-4acf-9bf0-6f05585d20ba';
                name: 't-shirt size';
                description: 'What is your t-shirt size?';
                type: 'text';
                value: 'md';
              },
            ];
            garnishments: [];
            date_of_birth: '1996-05-08';
            has_ssn: true;
            ssn: '';
            phone: '1234567890';
            preferred_first_name: 'Vanessa';
            work_email: null;
          };
        };
        'x-tags': ['Employees'];
        properties: {
          id: {
            type: 'number';
            description: 'The ID of the employee in Gusto.';
            readOnly: true;
          };
          uuid: {
            type: 'string';
            description: 'A unique identifier of the employee in Gusto.';
            readOnly: true;
          };
          first_name: {
            type: 'string';
          };
          middle_initial: {
            type: 'string';
            nullable: true;
          };
          last_name: {
            type: 'string';
          };
          email: {
            type: 'string';
            description: 'The email address of the employee. This is provided to support syncing users between our system and yours. You may not use this email address for any other purpose (e.g. marketing).';
            nullable: true;
          };
          company_id: {
            type: 'number';
            description: 'The ID of the company the employee is employed by.';
            readOnly: true;
          };
          company_uuid: {
            type: 'string';
            description: 'A unique identifier of the company the employee is employed by.';
            readOnly: true;
          };
          manager_id: {
            type: 'number';
            description: "The ID of the employee's manager in Gusto.";
            nullable: true;
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the employee. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
            readOnly: true;
          };
          department: {
            type: 'string';
            description: "The employee's department in the company.";
            nullable: true;
            readOnly: true;
          };
          terminated: {
            type: 'boolean';
            description: 'Whether the employee is terminated.';
            readOnly: true;
          };
          two_percent_shareholder: {
            type: 'boolean';
            description: 'Whether the employee is a two percent shareholder of the company. This field only applies to companies with an S-Corp entity type.';
          };
          onboarded: {
            type: 'boolean';
            description: 'Whether the employee has completed onboarding.';
            readOnly: true;
          };
          jobs: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Job';
            };
          };
          eligible_paid_time_off: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Paid-Time-Off';
            };
          };
          terminations: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Termination';
            };
          };
          home_address: {
            $ref: '#/components/schemas/Location';
          };
          garnishments: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Garnishment';
            };
          };
          custom_fields: {
            type: 'array';
            description: 'Custom fields are only included for the employee if the include param has the custom_fields value set';
            items: {
              $ref: '#/components/schemas/Employee-Custom-Field';
            };
          };
          date_of_birth: {
            type: 'string';
            nullable: true;
            readOnly: true;
          };
          has_ssn: {
            type: 'boolean';
            description: 'Indicates whether the employee has an SSN in Gusto.';
          };
          ssn: {
            type: 'string';
            description: 'Deprecated. This field always returns an empty string.';
          };
          phone: {
            type: 'string';
          };
          preferred_first_name: {
            type: 'string';
            description: '';
          };
          work_email: {
            type: 'string';
            description: 'The work email address of the employee. This is provided to support syncing users between our system and yours. You may not use this email address for any other purpose (e.g. marketing).';
            nullable: true;
          };
          current_employment_status: {
            type: 'string';
            description: 'The current employment status of the employee. Full-time employees work 30+ hours per week. Part-time employees are split into two groups: those that work 20-29 hours a week, and those that work under 20 hours a week. Variable employees have hours that vary each week. Seasonal employees are hired for 6 months of the year or less.';
            enum: ['full_time', 'part_time_under_twenty_hours', 'part_time_twenty_plus_hours', 'variable', 'seasonal'];
            nullable: true;
            readOnly: true;
          };
        };
        readOnly: true;
      };
      'Employee-Onboarding-Status': {
        description: "The representation of an employee's onboarding status.\n\n## onboarding_status\n\n### Admin-facilitated onboarding\n| onboarding_status | Description |\n| --- | ----------- |\n| `admin_onboarding_incomplete` | Admin needs to complete the full employee-onboarding. |\n| `onboarding_completed` | Employee has been fully onboarded and verified. |\n\n### Employee self-onboarding\n| onboarding_status | Description |\n| --- | ----------- |\n| `admin_onboarding_incomplete` | Admin needs to enter basic information about the employee. |\n| `self_onboarding_not_invited` | Admin has the intention to invite the employee to self-onboard (e.g., marking a checkbox), but the system has not yet sent the invitation. |\n| `self_onboarding_invited` | Employee has been sent an invitation to self-onboard. |\n| `self_onboarding_invited_started` | Employee has started the self-onboarding process. |\n| `self_onboarding_invited_overdue` | Employee's start date has passed, and employee has still not completed self-onboarding. |\n| `self_onboarding_awaiting_admin_review` | Admin needs to review employee's entered information and confirm onboarding. |\n| `onboarding_completed` | Employee has been fully onboarded and verified. |\n\n## onboarding_steps\n\n| onboarding_steps | Requirement(s) to be completed |\n| --- | ----------- |\n| `personal_details` | Add employee's first name, last name, email, date of birth, social security number |\n| `compensation_details` | Associate employee to a job & compensation. |\n| `add_work_address` | Add employee work address. |\n| `add_home_address` | Add employee home address. |\n| `federal_tax_setup` | Set up federal tax withholdings. |\n| `state_tax_setup` | Set up state tax withholdings. |\n| `direct_deposit_setup` | Set up employee's direct deposit. |\n| `employee_form_signing` | Employee forms (e.g., W4, direct deposit authorization) are generated & signed. |\n| `admin_review` | Admin reviews & confirms employee details. |";
        type: 'object';
        title: 'Employee-Onboarding-Status';
        'x-examples': {
          'Example - Employee Onboarding by Admin': {
            uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
            onboarding_status: 'admin_onboarding_incomplete';
            onboarding_steps: [
              {
                title: 'Personal details';
                id: 'personal_details';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter compensation details';
                id: 'compensation_details';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Add work address';
                id: 'add_work_address';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Add home address';
                id: 'add_home_address';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter federal tax withholdings';
                id: 'federal_tax_setup';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter state tax information';
                id: 'state_tax_setup';
                required: true;
                completed: false;
                requirements: ['add_work_address', 'add_home_address'];
              },
              {
                title: 'Direct deposit setup';
                id: 'direct_deposit_setup';
                required: false;
                completed: false;
                requirements: [];
              },
              {
                title: 'Employee form signing';
                id: 'employee_form_signing';
                required: true;
                completed: false;
                requirements: ['federal_tax_setup', 'state_tax_setup'];
              },
            ];
          };
          'Example - Employee Self-Onboarding': {
            uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
            onboarding_status: 'self_onboarding_invited';
            onboarding_steps: [
              {
                title: 'Personal details';
                id: 'personal_details';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter compensation details';
                id: 'compensation_details';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Add work address';
                id: 'add_work_address';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Add home address';
                id: 'add_home_address';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter federal tax withholdings';
                id: 'federal_tax_setup';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Enter state tax information';
                id: 'state_tax_setup';
                required: true;
                completed: false;
                requirements: ['add_work_address', 'add_home_address'];
              },
              {
                title: 'Direct deposit setup';
                id: 'direct_deposit_setup';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Employee form signing';
                id: 'employee_form_signing';
                required: true;
                completed: false;
                requirements: ['federal_tax_setup', 'state_tax_setup'];
              },
              {
                title: 'Admin review';
                id: 'admin_review';
                required: true;
                completed: false;
                requirements: [
                  'personal_details',
                  'compensation_details',
                  'add_home_address',
                  'add_work_address',
                  'federal_tax_setup',
                  'state_tax_setup',
                ];
              },
            ];
          };
        };
        'x-tags': ['Employees'];
        properties: {
          uuid: {
            type: 'string';
            description: 'Unique identifier for this employee.';
          };
          onboarding_status: {
            type: 'string';
            description: 'One of the "onboarding_status" enum values.';
          };
          onboarding_steps: {
            type: 'array';
            description: 'List of steps required to onboard an employee.';
            items: {
              title: 'Onboarding step';
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  description: 'User-friendly description of the onboarding step.';
                };
                id: {
                  type: 'string';
                  description: 'String identifier for the onboarding step.';
                };
                required: {
                  type: 'boolean';
                  description: 'When true, this step has been completed.';
                };
                completed: {
                  type: 'boolean';
                  description: 'When true, this step has been completed.';
                };
                requirements: {
                  type: 'array';
                  description: 'A list of onboarding steps required to begin this step.';
                  items: {
                    type: 'string';
                  };
                };
              };
            };
          };
        };
      };
      Location: {
        description: 'The representation of an address in Gusto.';
        type: 'object';
        'x-examples': {
          'Company Location': {
            company_id: 7756341740978008;
            version: '7d9753112507b9dda4fb97910f39b06e';
            phone_number: '5825710808';
            id: 7757727716657803;
            street_1: '412 Kiera Stravenue';
            street_2: 'Suite 391';
            city: 'San Francisco';
            state: 'CA';
            zip: '94107';
            country: 'USA';
            active: true;
          };
        };
        'x-tags': ['Locations'];
        title: '';
        properties: {
          id: {
            type: 'integer';
            description: 'The unique identifier of the location in Gusto.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          company_id: {
            type: 'integer';
            description: 'The ID for the company to which the location belongs. Only included if the location belongs to a company.';
            readOnly: true;
          };
          employee_id: {
            type: 'integer';
            description: 'The ID for the employee to which the location belongs. Only included if the location belongs to an employee.';
            readOnly: true;
          };
          phone_number: {
            type: 'string';
            readOnly: false;
            description: 'The phone number for the location. Required for company locations. Optional for employee locations.';
          };
          street_1: {
            type: 'string';
            readOnly: false;
          };
          street_2: {
            type: 'string';
            readOnly: false;
            nullable: true;
          };
          city: {
            type: 'string';
            readOnly: false;
          };
          state: {
            type: 'string';
            readOnly: false;
          };
          zip: {
            type: 'string';
            readOnly: false;
          };
          country: {
            type: 'string';
            readOnly: false;
            default: 'USA';
          };
          active: {
            type: 'boolean';
            description: 'The status of the location. Inactive locations have been deleted, but may still have historical data associated with them.';
            readOnly: true;
          };
          mailing_address: {
            type: 'boolean';
            description: "Specifies if the location is the company's mailing address. Only included if the location belongs to a company.";
          };
          filing_address: {
            description: "Specifies if the location is the company's filing address. Only included if the location belongs to a company.";
            type: 'boolean';
          };
        };
      };
      'Paid-Time-Off': {
        type: 'object';
        description: 'The representation of paid time off in Gusto.';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the paid time off type.';
            readOnly: true;
          };
          accrual_unit: {
            type: 'string';
            example: 'Hour';
            description: 'The unit the PTO type is accrued in.';
            readOnly: true;
          };
          accrual_rate: {
            type: 'string';
            description: 'The number of accrual units accrued per accrual period.';
            readOnly: true;
          };
          accrual_period: {
            type: 'string';
            example: 'Year';
            description: 'The frequency at which the PTO type is accrued.';
            readOnly: true;
          };
          accrual_balance: {
            type: 'string';
            description: 'The number of accrual units accrued.';
            readOnly: true;
          };
          maximum_accrual_balance: {
            type: 'string';
            nullable: true;
            description: 'The maximum number of accrual units allowed. A null value signifies no maximum.';
            readOnly: true;
          };
          paid_at_termination: {
            type: 'boolean';
            description: 'Whether the accrual balance is paid to the employee upon termination.';
            readOnly: true;
          };
        };
        'x-examples': {
          Example: {
            name: 'Sick Hours';
            accrual_unit: 'Hour';
            accrual_rate: '208.0';
            accrual_period: 'Year';
            accrual_balance: '64.0';
            maximum_accrual_balance: '240.0';
            paid_at_termination: false;
          };
        };
        'x-tags': ['Payrolls'];
      };
      Garnishment: {
        description: 'Garnishments, or employee deductions, are fixed amounts or percentages deducted from an employee’s pay. They can be deducted a specific number of times or on a recurring basis. Garnishments can also have maximum deductions on a yearly or per-pay-period bases. Common uses for garnishments are court-ordered payments for child support or back taxes. Some companies provide loans to their employees that are repaid via garnishments.';
        type: 'object';
        'x-examples': {
          Example: {
            id: 1363316538400333;
            version: '52b7c567242cb7452e89ba2bc02cb476';
            employee_id: 8964216891236743;
            active: true;
            amount: '8.00';
            description: 'Company loan to employee';
            court_ordered: false;
            times: 5;
            recurring: false;
            annual_maximum: null;
            pay_period_maximum: '100.00';
            deduct_as_percentage: true;
          };
        };
        properties: {
          id: {
            type: 'integer';
            description: 'The unique identifier of the garnishment in Gusto.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          employee_id: {
            type: 'integer';
            description: 'The ID of the employee to which this garnishment belongs.';
            readOnly: true;
          };
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
            nullable: true;
            readOnly: false;
            default: null;
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
            description: 'The maximum deduction per annum. A null value indicates no maximum. Represented as a float, e.g. "200.00".';
            type: 'string';
            nullable: true;
          };
          pay_period_maximum: {
            type: 'string';
            nullable: true;
            format: 'float';
            default: null;
            description: 'The maximum deduction per pay period. A null value indicates no maximum. Represented as a float, e.g. "16.00".';
          };
          deduct_as_percentage: {
            type: 'boolean';
            readOnly: false;
            default: false;
            description: 'Whether the amount should be treated as a percentage to be deducted per pay period.';
          };
        };
        'x-tags': ['Garnishments'];
      };
      Termination: {
        type: 'object';
        description: 'The representation of a termination in Gusto.';
        properties: {
          id: {
            type: 'integer';
            description: 'The unique identifier of the termination in Gusto.';
            readOnly: true;
          };
          uuid: {
            type: 'string';
            description: 'The UUID of the termination object.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          employee_id: {
            type: 'integer';
            description: 'The ID of the employee to which this termination is attached.';
            readOnly: true;
          };
          employee_uuid: {
            type: 'integer';
            description: 'The UUID of the employee to which this termination is attached.';
            readOnly: true;
          };
          active: {
            type: 'boolean';
            description: "Whether the employee's termination has gone into effect.";
            readOnly: true;
          };
          effective_date: {
            type: 'string';
            readOnly: false;
            description: "The employee's last day of work.";
          };
          run_termination_payroll: {
            type: 'boolean';
            readOnly: false;
            description: 'If true, the employee should recieve their final wages via an offcycle payroll. If false, they should recieve their final wages on their current pay schedule.';
          };
        };
        'x-examples': {
          'example-1': {
            id: 891238902131212;
            uuid: 'da441196-43a9-4d23-ad5d-f37ce6bb99c0';
            employee_id: 891238902131212;
            employee_uuid: 'da441196-43a9-4d23-ad5d-f37ce6bb99c0';
            version: 'd487dd0b55dfcacdd920ccbdaeafa351';
            active: true;
            effective_date: '2020-03-10';
            run_termination_payroll: false;
          };
        };
        'x-tags': ['Terminations'];
      };
      Compensation: {
        type: 'object';
        description: 'The representation of compensation in Gusto.';
        properties: {
          id: {
            type: 'integer';
            description: 'The unique identifier of the compensation in Gusto.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          job_id: {
            type: 'integer';
            description: 'The ID of the job to which the compensation belongs.';
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
          effective_date: {
            type: 'string';
            readOnly: false;
            description: "The effective date for this compensation. For the first compensation, this defaults to the job's hire date.";
          };
        };
        'x-examples': {
          Example: {
            id: 1363316536327004;
            version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
            job_id: 1123581321345589;
            rate: '70.00';
            payment_unit: 'Hour';
            flsa_status: 'Nonexempt';
            effective_date: '2020-12-11';
          };
        };
        'x-tags': ['Compensations'];
      };
      Form: {
        title: 'Form';
        type: 'object';
        properties: {
          uuid: {
            type: 'string';
            description: 'The UUID of the form';
            readOnly: true;
          };
          name: {
            type: 'string';
            description: 'The type identifier of the form';
            readOnly: true;
          };
          title: {
            type: 'string';
            description: 'The title of the form';
            readOnly: true;
          };
          description: {
            type: 'string';
            description: 'The description of the form';
            readOnly: true;
          };
          requires_signing: {
            type: 'boolean';
            description: 'A boolean flag that indicates whether the form needs signing or not. Note that this value will change after the form is signed.';
            readOnly: true;
          };
        };
        'x-examples': {
          Example: {
            uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408';
            name: 'company_direct_deposit';
            title: 'Direct Deposit Authorization';
            description: 'We need you to sign paperwork to authorize us to debit and credit your bank account and file and pay your taxes.';
            requires_signing: true;
          };
        };
        'x-tags': ['Forms'];
      };
      Industry: {
        title: 'Industry';
        type: 'object';
        properties: {
          company_uuid: {
            type: 'string';
            description: 'Company uuid';
            readOnly: true;
          };
          naics_code: {
            type: 'string';
            description: 'North American Industry Classification System (NAICS) is used to classify businesses with a six digit number based on the primary type of work the business performs.';
            readOnly: true;
          };
          sic_codes: {
            type: 'array';
            description: 'A list of Standard Industrial Classification (SIC) codes, which are four digit number that categorize the industries that companies belong to based on their business activities.';
            readOnly: true;
          };
          title: {
            type: 'string';
            description: 'Industry title';
            readOnly: true;
          };
        };
        'x-examples': {
          Example: {
            company_uuid: '423dd616-6dbc-4724-938a-403f6217a933';
            naics_code: '611420';
            sic_codes: ['8243'];
            title: 'Computer Training';
          };
        };
        'x-tags': ['Industry'];
      };
      Job: {
        title: 'Job';
        type: 'object';
        properties: {
          id: {
            type: 'integer';
            description: 'The unique identifier of the job in Gusto.';
            readOnly: true;
          };
          uuid: {
            type: 'string';
            description: 'the UUID of the job';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          employee_id: {
            type: 'integer';
            description: 'The ID of the employee to which the job belongs.';
            readOnly: true;
          };
          employee_uuid: {
            type: 'string';
            description: 'The UUID of the employee to which the job belongs.';
            readOnly: true;
          };
          location_id: {
            type: 'integer';
            readOnly: false;
            description: "The ID of the job's work location.";
          };
          location: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
                readOnly: true;
              };
              street_1: {
                type: 'string';
                readOnly: true;
              };
              street_2: {
                type: 'string';
                nullable: true;
                readOnly: true;
              };
              city: {
                type: 'string';
                readOnly: true;
              };
              state: {
                type: 'string';
                readOnly: true;
              };
              zip: {
                type: 'string';
                readOnly: true;
              };
              country: {
                type: 'string';
                readOnly: true;
              };
              inactive: {
                type: 'boolean';
                readOnly: true;
                description: 'Whether the location of the job is active.';
              };
            };
          };
          hire_date: {
            type: 'string';
            readOnly: false;
            description: 'The date when the employee was hired for the job.';
          };
          title: {
            type: 'string';
            readOnly: false;
            default: null;
            nullable: true;
            description: 'The title for the job.';
          };
          primary: {
            type: 'boolean';
            description: 'Whether this is the employee’s primary job. The value will be set to true unless an existing job exists for the employee.';
            readOnly: true;
          };
          rate: {
            type: 'string';
            description: 'The current compensation rate of the job.';
            readOnly: true;
          };
          payment_unit: {
            type: 'string';
            description: 'The payment unit of the current compensation for the job.';
            readOnly: true;
          };
          current_compensation_id: {
            type: 'integer';
            description: 'The ID for the current compensation of the job.';
            readOnly: true;
          };
          current_compensation_uuid: {
            type: 'string';
            description: 'The UUID of the current compensation of the job.';
            readOnly: true;
          };
          compensations: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Compensation';
            };
            readOnly: true;
          };
        };
        description: 'The representation of a job in Gusto.';
        'x-examples': {
          Example: {
            id: 7757869441038000;
            uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
            version: 'd0e719137f89ca3dd334dd4cc248ffbb';
            employee_id: 7757869432666661;
            employee_uuid: '948daac8-4355-4ece-9e2a-229898accb22';
            current_compensation_id: 7757869444844981;
            current_compensation_uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
            payment_unit: 'Year';
            primary: true;
            title: 'Account Director';
            compensations: [
              {
                id: 7757869444844981;
                uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
                version: '994b75511d1debac5d7e2ddeae13679f';
                payment_unit: 'Year';
                flsa_status: 'Exempt';
                job_id: 7757869441038000;
                job_uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
                effective_date: '2021-01-20';
                rate: '78000.00';
              },
            ];
            rate: '78000.00';
            hire_date: '2020-01-20';
            location_id: 7757727716657803;
            location: {
              id: 7757727716657803;
              street_1: '412 Kiera Stravenue';
              street_2: 'Suite 391';
              city: 'San Francisco';
              state: 'CA';
              zip: '94107';
              country: 'USA';
              inactive: false;
            };
          };
        };
        'x-tags': ['Jobs'];
      };
      Admin: {
        title: 'Admin';
        type: 'object';
        description: 'The representation of an admin user in Gusto.';
        'x-examples': {
          Example: {
            uuid: '987058cc-23ee-46e9-81ef-5cee086cceca';
            first_name: 'John';
            last_name: 'Smith';
            email: 'jsmith99@gmail.com';
          };
        };
        properties: {
          uuid: {
            type: 'string';
            description: 'The unique id of the admin.';
          };
          email: {
            type: 'string';
            description: 'The email of the admin. This is used by the admin to log in to their account.';
          };
          first_name: {
            type: 'string';
            description: 'The first name of the admin.';
          };
          last_name: {
            type: 'string';
            description: 'The last name of the admin.';
          };
        };
        'x-tags': ['Admins'];
      };
      Company: {
        title: 'Company';
        type: 'object';
        description: 'The representation of a company in Gusto.';
        properties: {
          ein: {
            type: 'string';
            description: 'The Federal Employer Identification Number of the company.';
            readOnly: true;
          };
          entity_type: {
            type: 'string';
            description: 'The tax payer type of the company.';
            enum: [
              'C-Corporation',
              'S-Corporation',
              'Sole proprietor',
              'LLC',
              'LLP',
              'Limited partnership',
              'Co-ownership',
              'Association',
              'Trusteeship',
              'General partnership',
              'Joint venture',
              'Non-Profit',
            ];
            readOnly: true;
          };
          tier: {
            type: 'string';
            description: 'The Gusto product tier of the company.';
            nullable: true;
            readOnly: true;
            enum: ['core', 'complete', 'concierge', 'contractor_only', 'basic'];
          };
          is_suspended: {
            type: 'boolean';
            description: 'Whether or not the company is suspended in Gusto. Suspended companies may not run payroll.';
          };
          company_status: {
            type: 'string';
            description: 'The status of the company in Gusto. "Approved" companies may run payroll with Gusto. "Not Approved" companies may not yet run payroll with Gusto. In order to run payroll, the company may need to complete onboarding or contact support. "Suspended" companies may not run payroll with Gusto. In order to unsuspend their account, the company must contact support.';
            enum: ['Approved', 'Not Approved', 'Suspended'];
            readOnly: true;
          };
          id: {
            type: 'number';
            description: 'The unique identifier of the company in Gusto.';
            readOnly: true;
          };
          uuid: {
            type: 'string';
            description: 'A unique identifier of the company in Gusto.';
            readOnly: true;
          };
          name: {
            type: 'string';
            description: 'The name of the company.';
            readOnly: true;
          };
          trade_name: {
            type: 'string';
            description: 'The trade name of the company.';
            readOnly: true;
          };
          locations: {
            type: 'array';
            uniqueItems: false;
            description: 'The locations of the company.';
            items: {
              $ref: '#/components/schemas/Location';
            };
            readOnly: true;
          };
          compensations: {
            type: 'object';
            description: 'The available company-wide compensation rates for the company.';
            properties: {
              hourly: {
                type: 'array';
                uniqueItems: true;
                description: 'The available hourly compensation rates for the company.';
                items: {
                  type: 'object';
                  properties: {
                    name: {
                      type: 'string';
                      description: 'The name of the hourly compensation rate.';
                      example: 'Overtime';
                      readOnly: true;
                    };
                    multiple: {
                      type: 'number';
                      description: 'The amount multiplied by the base rate of a job to calculate compensation.';
                      example: 1.5;
                      readOnly: true;
                    };
                  };
                  readOnly: true;
                };
                readOnly: true;
              };
              fixed: {
                type: 'array';
                uniqueItems: true;
                description: 'The available fixed compensation rates for the company.';
                items: {
                  type: 'object';
                  properties: {
                    name: {
                      type: 'string';
                      description: 'The name of the fixed compensation.';
                      example: 'Bonus';
                    };
                  };
                  readOnly: true;
                };
                readOnly: true;
              };
              paid_time_off: {
                type: 'array';
                uniqueItems: true;
                description: 'The available types of paid time off for the company.';
                items: {
                  type: 'object';
                  properties: {
                    name: {
                      type: 'string';
                      example: 'Vacation Hours';
                      description: 'The name of the paid time off type.';
                      readOnly: true;
                    };
                  };
                  readOnly: true;
                };
                readOnly: true;
              };
            };
            readOnly: true;
          };
          primary_signatory: {
            type: 'object';
            description: 'The primary signatory of the company.';
            properties: {
              first_name: {
                type: 'string';
                readOnly: true;
              };
              middle_initial: {
                type: 'string';
                readOnly: true;
              };
              last_name: {
                type: 'string';
                readOnly: true;
              };
              phone: {
                type: 'string';
                readOnly: true;
              };
              email: {
                type: 'string';
                readOnly: true;
              };
              home_address: {
                type: 'object';
                properties: {
                  street_1: {
                    type: 'string';
                    readOnly: true;
                  };
                  street_2: {
                    type: 'string';
                    nullable: true;
                    readOnly: true;
                  };
                  city: {
                    type: 'string';
                    readOnly: true;
                  };
                  state: {
                    type: 'string';
                    readOnly: true;
                  };
                  zip: {
                    type: 'string';
                    readOnly: true;
                  };
                  country: {
                    type: 'string';
                    readOnly: true;
                  };
                };
                readOnly: true;
              };
            };
            readOnly: true;
          };
          primary_payroll_admin: {
            type: 'object';
            description: 'The primary payroll admin of the company.';
            properties: {
              first_name: {
                type: 'string';
                readOnly: true;
              };
              last_name: {
                type: 'string';
                readOnly: true;
              };
              phone: {
                type: 'string';
                readOnly: true;
              };
              email: {
                type: 'string';
                readOnly: true;
              };
            };
          };
        };
        'x-examples': {
          Example: {
            ein: '00-0000001';
            entity_type: 'C-Corporation';
            tier: 'complete';
            is_suspended: false;
            company_status: 'Approved';
            id: 7756341740978008;
            name: 'Shoppe Studios LLC';
            trade_name: 'Record Shoppe';
            locations: [
              {
                id: 7757727716657803;
                street_1: '412 Kiera Stravenue';
                street_2: 'Suite 391';
                city: 'San Francisco';
                state: 'CA';
                zip: '94107';
                country: 'USA';
                active: true;
              },
              {
                id: 7757727716657804;
                street_1: '644 Fay Vista';
                street_2: 'Suite 842';
                city: 'Richmond';
                state: 'VA';
                zip: '23218';
                country: 'USA';
                active: true;
              },
            ];
            compensations: {
              hourly: [
                {
                  name: 'Overtime';
                  multiple: 1.5;
                },
                {
                  name: 'Double overtime';
                  multiple: 2;
                },
                {
                  name: 'Regular';
                  multiple: 1;
                },
                {
                  name: 'Outstanding vacation';
                  multiple: 1;
                },
                {
                  name: 'Holiday';
                  multiple: 1;
                },
                {
                  name: 'Emergency sick - self care';
                  multiple: 1;
                },
                {
                  name: 'Emergency sick - caring for others';
                  multiple: 1;
                },
                {
                  name: 'FMLA Public Health Emergency Leave';
                  multiple: 1;
                },
                {
                  name: 'Regular Hours';
                  multiple: 1;
                },
              ];
              fixed: [
                {
                  name: 'Bonus';
                },
                {
                  name: 'Commission';
                },
                {
                  name: 'Paycheck Tips';
                },
                {
                  name: 'Cash Tips';
                },
                {
                  name: 'Correction Payment';
                },
                {
                  name: 'Severance';
                },
                {
                  name: 'Minimum Wage Adjustment';
                },
                {
                  name: 'Reimbursement';
                },
              ];
              paid_time_off: [
                {
                  name: 'Vacation Hours';
                },
                {
                  name: 'Sick Hours';
                },
                {
                  name: 'Holiday Hours';
                },
              ];
            };
            primary_signatory: {
              first_name: 'Alda';
              middle_initial: '';
              last_name: 'Carter';
              phone: null;
              email: 'louie.hessel7757869450111547@zemlak.biz';
              home_address: {
                street_1: '524 Roob Divide';
                street_2: 'Suite 565';
                city: 'San Francisco';
                state: 'CA';
                zip: '94107';
                country: 'USA';
              };
            };
            primary_payroll_admin: {
              first_name: 'Ian';
              last_name: 'Labadie';
              phone: '1-565-710-7559';
              email: 'louie.hessel7757869450111547@zemlak.biz';
            };
          };
        };
        'x-tags': ['Companies'];
      };
      'Company-Onboarding-Status': {
        description: "The representation of a company's onboarding status";
        type: 'object';
        title: '';
        'x-examples': {
          Example: {
            uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
            onboarding_completed: false;
            onboarding_steps: [
              {
                title: "Add Your Company's Addresses";
                id: 'add_addresses';
                required: true;
                completed: true;
                requirements: [];
              },
              {
                title: 'Add Your Employees';
                id: 'add_employees';
                required: true;
                completed: true;
                requirements: ['add_addresses'];
              },
              {
                title: 'Enter Your Federal Tax Information';
                id: 'federal_tax_setup';
                required: true;
                completed: true;
                requirements: ['add_addresses', 'add_employees'];
              },
              {
                title: 'Add Your Bank Account';
                id: 'add_bank_info';
                required: true;
                completed: true;
                requirements: [];
              },
              {
                title: 'Select a Pay Schedule';
                id: 'payroll_schedule';
                required: true;
                completed: false;
                requirements: [];
              },
              {
                title: 'Sign Documents';
                id: 'sign_all_forms';
                required: true;
                completed: false;
                requirements: [
                  'add_employees',
                  'federal_tax_setup',
                  'state_setup',
                  'add_bank_info',
                  'payroll_schedule',
                ];
              },
              {
                title: 'Verify Your Bank Account';
                id: 'verify_bank_info';
                required: true;
                completed: false;
                requirements: ['add_bank_info'];
              },
            ];
          };
        };
        'x-tags': ['Companies'];
        properties: {
          uuid: {
            type: 'string';
            description: 'the UUID of the company';
          };
          onboarding_completed: {
            type: 'boolean';
            description: "a boolean flag for the company's onboarding status";
          };
          onboarding_steps: {
            type: 'array';
            description: 'a list of company onboarding steps';
            items: {
              title: 'Onboarding step';
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  description: 'The display name of the onboarding step';
                };
                id: {
                  type: 'string';
                  description: 'The string identifier for each onboarding step';
                };
                required: {
                  type: 'boolean';
                  description: 'The boolean flag indicating whether the step is required or optional';
                };
                completed: {
                  type: 'boolean';
                  description: 'The boolean flag indicating whether the step is completed or not.';
                };
                requirements: {
                  type: 'array';
                  description: 'A list of onboarding step that are required to be completed in order to proceed with the current onboarding step.';
                  items: {
                    type: 'string';
                  };
                };
              };
            };
          };
          '': {
            type: 'string';
          };
        };
      };
      'Payment-Configs': {
        title: 'Payment-Configs';
        type: 'object';
        properties: {
          company_uuid: {
            type: 'string';
            description: 'Company uuid';
            readOnly: true;
          };
          partner_uuid: {
            type: 'string';
            description: 'Partner uuid';
            readOnly: true;
          };
          fast_payment_limit: {
            type: 'number';
            description: 'Payment limit only applicable for 2-day payroll';
            readOnly: true;
          };
          payment_speed: {
            type: 'string';
            description: 'Payment speed for 2-day / 4-day';
            readOnly: true;
          };
        };
        'x-examples': {
          Example: {
            company_uuid: '423dd616-6dbc-4724-938a-403f6217a933';
            partner_uuid: '556f05d0-48e0-4c47-bce5-db9aea923043';
            fast_payment_limit: 5000;
            payment_speed: '2-day';
          };
        };
        'x-tags': ['Payment Configs (Beta)'];
      };
      Contractor: {
        description: 'The representation of a contractor (individual or business) in Gusto.';
        type: 'object';
        'x-examples': {
          'Individual Contractor': {
            id: 7757515807594512;
            company_id: 7757616923763477;
            wage_type: 'Hourly';
            is_active: true;
            version: '63859768485e218ccf8a449bb60f14ed';
            type: 'Individual';
            first_name: 'Kory';
            last_name: 'Gottlieb';
            middle_initial: 'P';
            business_name: null;
            ein: null;
            email: 'keira.west@mckenzie.org';
            address: {
              street_1: '621 Jast Row';
              street_2: 'Apt. 281';
              city: 'Coral Springs';
              state: 'FL';
              zip: '33065';
              country: 'USA';
            };
            hourly_rate: '40.00';
          };
          'Business Contractor': {
            id: 7757515807614539;
            company_id: 7757616923763477;
            wage_type: 'Fixed';
            is_active: true;
            version: '8aab307f1e8ed788697f8986346af559';
            type: 'Business';
            first_name: null;
            last_name: null;
            middle_initial: null;
            business_name: 'Labadie-Stroman';
            ein: 'XX-XXX0001';
            email: 'jonatan@kerluke.info';
            address: {
              street_1: '1625 Bednar Center';
              street_2: 'Apt. 480';
              city: 'Port Charlotte';
              state: 'FL';
              zip: '33954';
              country: 'USA';
            };
            hourly_rate: '0.00';
          };
        };
        title: '';
        properties: {
          id: {
            type: 'number';
            description: 'The unique identifier of the contractor in Gusto.';
            readOnly: true;
          };
          company_id: {
            type: 'number';
            description: 'The ID of the company the contractor is employed by.';
            readOnly: true;
          };
          wage_type: {
            type: 'string';
            enum: ['Fixed', 'Hourly'];
            description: 'The contractor\'s wage type, either "Fixed" or "Hourly".';
          };
          is_active: {
            type: 'boolean';
            default: true;
            description: 'The status of the contractor with the company.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          type: {
            type: 'string';
            enum: ['Individual', 'Business'];
            description: 'The contractor\'s type, either "Individual" or "Business". ';
          };
          first_name: {
            type: 'string';
            nullable: true;
            description: 'The contractor’s first name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.';
          };
          last_name: {
            type: 'string';
            nullable: true;
            description: 'The contractor’s last name. This attribute is required for “Individual” contractors and will be ignored for “Business” contractors.';
          };
          middle_initial: {
            type: 'string';
            nullable: true;
            description: 'The contractor’s middle initial. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors.';
          };
          business_name: {
            type: 'string';
            nullable: true;
            description: 'The name of the contractor business. This attribute is required for “Business” contractors and will be ignored for “Individual” contractors.';
          };
          ein: {
            type: 'string';
            nullable: true;
            description: 'The Federal Employer Identification Number of the contractor business. This attribute is optional for “Business” contractors and will be ignored for “Individual” contractors.';
          };
          email: {
            type: 'string';
            nullable: true;
            description: 'The contractor’s email address. This attribute is optional for “Individual” contractors and will be ignored for “Business” contractors. ';
          };
          address: {
            type: 'object';
            description: 'The contractor’s home address.';
            properties: {
              street_1: {
                type: 'string';
                readOnly: true;
              };
              street_2: {
                type: 'string';
                nullable: true;
                readOnly: true;
              };
              city: {
                type: 'string';
                readOnly: true;
              };
              state: {
                type: 'string';
                readOnly: true;
              };
              zip: {
                type: 'string';
                readOnly: true;
              };
              country: {
                type: 'string';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          hourly_rate: {
            type: 'string';
            example: '50.0';
            description: 'The contractor’s hourly rate. This attribute is required if the wage_type is “Hourly”.';
          };
        };
        'x-tags': ['Contractors'];
      };
      'Contractor-Payment': {
        description: 'The representation of a single contractor payment.';
        type: 'object';
        'x-examples': {
          Example: {
            id: '04552eb9-7829-4b18-ae96-6983552948df';
            bonus: '20.0';
            date: '2020-10-19';
            hours: '40.0';
            payment_method: 'Direct Deposit';
            reimbursement: '100.0';
            hourly_rate: '18.0';
            wage: '0.0';
            wage_type: 'Hourly';
            wage_total: '740.00';
          };
        };
        title: 'Contractor Payment';
        properties: {
          uuid: {
            type: 'string';
            description: 'The unique identifier of the contractor payment in Gusto.';
            readOnly: true;
          };
          contractor_id: {
            type: 'number';
            description: 'The unique identifier of the contractor in Gusto.';
            readOnly: true;
          };
          bonus: {
            type: 'string';
            description: 'The bonus amount in the payment.';
            readOnly: true;
          };
          date: {
            type: 'string';
            description: 'The payment date.';
            readOnly: true;
          };
          hours: {
            type: 'string';
            description: 'The number of hours worked for the payment.';
            readOnly: true;
          };
          payment_method: {
            type: 'string';
            description: 'The payment method.';
            enum: ['Direct Deposit', 'Check', 'Historical Payment', 'Correction Payment'];
            readOnly: true;
          };
          reimbursement: {
            type: 'string';
            description: 'The reimbursement amount in the payment.';
            readOnly: true;
          };
          hourly_rate: {
            type: 'string';
            description: 'The rate per hour worked for the payment.';
            readOnly: true;
          };
          wage: {
            type: 'string';
            description: 'The fixed wage of the payment, regardless of hours worked.';
            readOnly: true;
          };
          wage_type: {
            type: 'string';
            description: 'The wage type for the payment.';
            enum: ['Hourly', 'Fixed'];
            readOnly: true;
          };
          wage_total: {
            type: 'string';
            description: '(hours * hourly_rate) + wage + bonus';
            readOnly: true;
          };
        };
        'x-tags': ['Contractor Payments'];
      };
      'Contractor-Payment-Summary': {
        description: 'The representation of the summary of contractor payments for a given company in a given time period.';
        type: 'object';
        'x-examples': {
          Example: {
            total: {
              reimbursements: '110.0';
              wages: '1840.0';
            };
            contractor_payments: [
              {
                contractor_id: 1234;
                reimbursement_total: '110.0';
                wage_total: '1840.0';
                payments: [
                  {
                    id: '04552eb9-7829-4b18-ae96-6983552948df';
                    bonus: '20.0';
                    date: '2020-10-19';
                    hours: '40.0';
                    payment_method: 'Direct Deposit';
                    reimbursement: '100.0';
                    hourly_rate: '18.0';
                    wage: '0.0';
                    wage_type: 'Hourly';
                    wage_total: '740.00';
                  },
                  {
                    id: '25cfeb96-17fc-4fdf-8941-57f3fb9eea00';
                    bonus: '100.0';
                    date: '2020-10-19';
                    hours: '0.00';
                    payment_method: 'Direct Deposit';
                    reimbursement: '10.0';
                    hourly_rate: '0.0';
                    wage: '1000.0';
                    wage_type: 'Fixed';
                    wage_total: '1100.0';
                  },
                ];
              },
            ];
          };
        };
        properties: {
          total: {
            type: 'object';
            description: 'The wage and reimbursement totals for all contractor payments within a given time period.';
            properties: {
              reimbursements: {
                type: 'string';
                description: 'The total reimbursements for contractor payments within a given time period.';
                readOnly: true;
              };
              wages: {
                type: 'string';
                description: 'The total wages for contractor payments within a given time period.';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          contractor_payments: {
            type: 'array';
            uniqueItems: false;
            description: 'The individual contractor payments, within a given time period, grouped by contractor.';
            items: {
              type: 'object';
              description: '';
              properties: {
                contractor_id: {
                  type: 'number';
                  description: 'The ID of the contractor.';
                  readOnly: true;
                };
                reimbursement_total: {
                  type: 'string';
                  description: 'The total remibursements for the contractor within a given time period.';
                  readOnly: true;
                };
                wage_total: {
                  type: 'string';
                  description: 'The total wages for the contractor within a given time period.';
                  readOnly: true;
                };
                payments: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'The contractor’s payments within a given time period.\n';
                  items: {
                    $ref: '#/components/schemas/Contractor-Payment';
                  };
                  readOnly: true;
                };
              };
              readOnly: true;
            };
            readOnly: true;
          };
        };
        'x-tags': ['Contractor Payments'];
      };
      'Time-Off-Request': {
        title: 'Time-Off-Request';
        type: 'object';
        'x-examples': {
          Example: {
            id: '1';
            status: 'approved';
            employee_note: 'Vacation at Disney World!';
            employer_note: 'But Universal has Harry Potter World...';
            days: {
              '2019-06-01': '4.000';
              '2019-06-02': '8.000';
              '2019-06-03': '2.000';
            };
            request_type: 'vacation';
            employee: {
              id: '234567';
              full_name: 'Jessica Gusto';
            };
            approver: {
              id: '345678';
              full_name: 'Karen Gusto';
            };
            initiator: {
              id: '234567';
              full_name: 'Jessica Gusto';
            };
          };
        };
        description: 'The representation of a time off request. ';
        'x-tags': ['Time Off Requests'];
        properties: {
          id: {
            type: 'integer';
            description: 'The ID of the time off request.';
            readOnly: true;
          };
          status: {
            type: 'string';
            description: 'The status of the time off request.';
            enum: ['pending', 'approved', 'denied'];
            readOnly: true;
          };
          employee_note: {
            type: 'string';
            description: 'A note about the time off request, from the employee to the employer.';
            readOnly: true;
          };
          employer_note: {
            type: 'string';
            description: 'A note about the time off request, from the employer to the employee.';
            readOnly: true;
          };
          request_type: {
            type: 'string';
            description: 'The type of time off request.';
            enum: ['vacation', 'sick'];
            readOnly: true;
          };
          days: {
            description: 'An object that represents the days in the time off request. The keys of the object are the dates, formatted as a YYYY-MM-DD string. The values of the object are the number of hours requested off for each day, formatted as a string representation of a numeric decimal to the thousands place.';
            type: 'object';
            readOnly: true;
          };
          employee: {
            type: 'object';
            description: '';
            properties: {
              id: {
                type: 'string';
                description: 'The ID of the employee the time off request is for.';
                readOnly: true;
              };
              full_name: {
                type: 'string';
                description: 'The full name of the employee the time off request is for.';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          initiator: {
            type: 'object';
            nullable: true;
            description: '';
            properties: {
              id: {
                type: 'string';
                description: 'The ID of the employee who initiated the time off request.';
                readOnly: true;
              };
              full_name: {
                type: 'string';
                description: 'The full name of the employee who initiated the time off request.';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          approver: {
            type: 'object';
            nullable: true;
            description: 'This value will be null if the request has not been approved.';
            properties: {
              id: {
                type: 'string';
                description: 'The ID of the employee who approved the time off request.';
                readOnly: true;
              };
              full_name: {
                type: 'string';
                description: 'The full name of the employee who approved the time off request.';
                readOnly: true;
              };
            };
            readOnly: true;
          };
        };
      };
      'Current-User': {
        description: '';
        type: 'object';
        'x-examples': {
          Example: {
            id: 1409720965546346;
            email: 'torrance.considine1409720965546346@schuster.info';
            roles: {
              payroll_admin: {
                companies: [
                  {
                    id: 1409720965614302;
                    name: 'Crist-Balistreri Group';
                    tier: 'complete';
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
        'x-tags': ['Current User'];
        properties: {
          id: {
            type: 'number';
            description: 'The ID of the current user.';
            readOnly: true;
          };
          email: {
            type: 'string';
            description: 'The email address of the authenticated user.';
            readOnly: true;
          };
          roles: {
            type: 'object';
            description: "An object containing each of the user's permissions.";
            properties: {
              payroll_admin: {
                type: 'object';
                properties: {
                  companies: {
                    type: 'array';
                    uniqueItems: true;
                    description: 'A lists of companies for which the current user has admin permissions. Users (most notably accountants) can have priviliges with multiple companies.';
                    items: {
                      type: 'object';
                      properties: {
                        id: {
                          type: 'number';
                          description: 'The ID of the company.';
                          readOnly: true;
                        };
                        name: {
                          type: 'string';
                          description: 'The name of the company.';
                          readOnly: true;
                        };
                        trade_name: {
                          type: 'string';
                          description: 'The trade name of the company.';
                          readOnly: true;
                        };
                        locations: {
                          type: 'array';
                          uniqueItems: true;
                          description: 'A list of the company locations.';
                          items: {
                            $ref: '#/components/schemas/Location';
                          };
                          readOnly: true;
                        };
                      };
                      readOnly: true;
                    };
                    readOnly: true;
                  };
                };
                readOnly: true;
              };
            };
            readOnly: true;
          };
        };
      };
      'Pay-Schedule': {
        type: 'object';
        title: 'Pay Schedule';
        example: {
          id: 1;
          frequency: 'Twice per month';
          anchor_pay_date: '2018-09-01';
          day_1: 1;
          day_2: 15;
          name: 'Salaried';
        };
        'x-examples': {
          Example: {
            id: 1;
            frequency: 'Twice per month';
            anchor_pay_date: '2020-05-15';
            day_1: 15;
            day_2: 31;
            name: 'Engineering';
          };
        };
        description: 'The representation of a pay schedule.';
        properties: {
          id: {
            type: 'integer';
            description: 'The identifier of the pay schedule.';
            readOnly: true;
          };
          uuid: {
            type: 'string';
            description: 'The unique identifier of the pay schedule in Gusto.';
            readOnly: true;
          };
          frequency: {
            type: 'string';
            description: 'The frequency that employees on this pay schedule are paid with Gusto.';
            enum: ['Every week', 'Every other week', 'Twice per month', 'Monthly'];
            readOnly: true;
          };
          anchor_pay_date: {
            type: 'string';
            description: 'The first date that employees on this pay schedule are paid with Gusto.';
            readOnly: true;
          };
          day_1: {
            type: 'integer';
            nullable: true;
            description: 'An integer between 1 and 31 indicating the first day of the month that employees are paid. This field is only relevant for pay schedules with the “Twice per month” and “Monthly” frequencies. It will be null for pay schedules with other frequencies.';
            readOnly: true;
          };
          day_2: {
            type: 'integer';
            nullable: true;
            description: 'An integer between 1 and 31 indicating the second day of the month that employees are paid. This field is the second pay date for pay schedules with the “Twice per month” frequency. It will be null for pay schedules with other frequencies.';
            readOnly: true;
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'Hourly when the pay schedule is for hourly employees. Salaried when the pay schedule is for salaried employees. It will be null when the pay schedule is for all employees.';
            readOnly: true;
          };
          auto_pilot: {
            type: 'boolean';
            description: 'With Autopilot® enabled, payroll will run automatically one day before your payroll deadlines.';
          };
        };
        'x-tags': ['Pay Schedules'];
      };
      'Company-Bank-Account': {
        description: 'The company bank account';
        type: 'object';
        'x-examples': {
          Example: {
            uuid: '1263eae5-4411-48d9-bd6d-18ed93082e65';
            company_uuid: 'e2c4c0ce-2986-48b9-86cf-ec27f6ed9a36';
            account_type: 'Checking';
            routing_number: '851070439';
            hidden_account_number: 'XXXX4087';
            verification_status: 'verified';
            verification_type: 'bank_deposits';
          };
        };
        'x-tags': ['Company Bank Accounts'];
        properties: {
          uuid: {
            type: 'string';
            description: 'UUID of the bank account';
          };
          company_uuid: {
            type: 'string';
            description: 'UUID of the company';
          };
          account_type: {
            type: 'string';
            description: 'Bank account type';
            enum: ['Checking', 'Savings'];
          };
          routing_number: {
            type: 'string';
            description: "The bank account's routing number";
          };
          hidden_account_number: {
            type: 'string';
            description: 'Masked bank account number';
          };
          verification_status: {
            type: 'string';
            enum: ['awaiting_deposits', 'ready_for_verification', 'verified'];
            description: "The verification status of the bank account.\n\n'awaiting_deposits' means the bank account is just created and money is being transferred.\n'ready_for_verification' means the micro-deposits are completed and the verification process can begin by using the verify endpoint.\n'verified' means the bank account is verified.";
          };
          verification_type: {
            type: 'string';
            enum: ['bank_deposits', 'plaid'];
            description: "The verification type of the bank account.\n\n'bank_deposits' means the bank account is connected by entering routing and accouting numbers and verifying through micro-deposits.\n'plaid' means the bank account is connected through Plaid.";
          };
          plaid_status: {
            type: 'string';
            enum: ['connected', 'disconnected'];
            description: 'The Plaid connection status of the bank account. Only apply when verification type is Plaid.';
          };
          last_cached_balance: {
            type: 'string';
            description: 'The last fetch balance for the bank account. Please be awared this amount is not reflecting to the most up-to-date balance. Only apply when verification type is Plaid.';
          };
          balance_fetched_date: {
            type: 'string';
            description: 'The balance fetch date associate with the last_cached_balance. Only apply when verification type is Plaid.';
          };
        };
      };
      'Supported-Benefit': {
        description: '';
        type: 'object';
        properties: {
          id: {
            type: 'number';
            description: 'The ID of the benefit type in Gusto.';
            readOnly: true;
          };
          name: {
            type: 'string';
            description: 'The name of the benefit.';
            readOnly: true;
          };
          description: {
            type: 'string';
            description: 'The description of the benefit.';
            readOnly: true;
          };
          pretax: {
            type: 'boolean';
            description: 'Whether the benefit is deducted before tax calculations, thus reducing one’s taxable income';
            readOnly: true;
          };
          posttax: {
            type: 'boolean';
            description: 'Whether the benefit is deducted after tax calculations.';
            readOnly: true;
          };
          imputed: {
            type: 'boolean';
            description: 'Whether the benefit is considered imputed income.';
            readOnly: true;
          };
          healthcare: {
            type: 'boolean';
            description: 'Whether the benefit is healthcare related.';
            readOnly: true;
          };
          retirement: {
            type: 'boolean';
            description: 'Whether the benefit is associated with retirement planning.';
            readOnly: true;
          };
          yearly_limit: {
            type: 'boolean';
            description: 'Whether the benefit has a government mandated yearly limit.';
            readOnly: true;
          };
        };
        'x-examples': {
          Example: {
            id: 1;
            name: 'Medical Insurance';
            description: 'Deductions and contributions for Medical Insurance';
            pretax: true;
            posttax: false;
            imputed: false;
            healthcare: true;
            retirement: false;
            yearly_limit: false;
          };
        };
        'x-tags': ['Benefits'];
      };
      'Company-Benefit': {
        description: 'The representation of a company benefit.';
        type: 'object';
        'x-examples': {
          Example: {
            id: 1363316536327004;
            version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
            company_id: 1363316537128394;
            benefit_id: 1;
            active: true;
            description: 'Kaiser Permanente';
            supports_percentage_amounts: true;
            responsible_for_employer_taxes: false;
            responsible_for_employee_w2: false;
          };
        };
        properties: {
          id: {
            type: 'number';
            description: 'The ID of the company benefit.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          company_id: {
            type: 'number';
            description: 'The ID of the company to which the company benefit belongs.';
            readOnly: true;
          };
          benefit_id: {
            type: 'number';
            description: 'The ID of the benefitt to which the company benefit belongs.';
            readOnly: true;
          };
          active: {
            type: 'boolean';
            default: true;
            description: 'Whether this benefit is active for employee participation. Company benefits may only be deactivated if no employees are actively participating.';
          };
          description: {
            type: 'string';
            minLength: 1;
            description: 'The description of the company benefit.For example, a company may offer multiple benefits with an ID of 1 (for Medical Insurance). The description would show something more specific like “Kaiser Permanente” or “Blue Cross/ Blue Shield”.';
          };
          supports_percentage_amounts: {
            type: 'boolean';
            description: 'Whether employee deductions and company contributions can be set as percentages of payroll for an individual employee. This is determined by the type of benefit and is not configurable by the company.';
            readOnly: true;
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
        'x-tags': ['Benefits'];
      };
      'Earning-Type': {
        description: '';
        type: 'object';
        'x-examples': {
          Example: {
            name: 'Cash Tips';
            uuid: 'f5618c94-ed7d-4366-b2c4-ff05e430064f';
          };
        };
        properties: {
          name: {
            type: 'string';
            description: 'The name of the earning type.';
          };
          uuid: {
            type: 'string';
            description: 'The ID of the earning type.';
            readOnly: true;
          };
        };
        'x-tags': ['Earning Type'];
      };
      'Employee-Benefit': {
        description: 'The representation of an employee benefit.';
        type: 'object';
        'x-tags': ['Benefits'];
        title: '';
        'x-examples': {
          Example: {
            id: 1363316536327004;
            version: '09j3d29jqdpj92109j9j2d90dq';
            employee_id: 908123091820398;
            company_benefit_id: 290384923980230;
            active: true;
            employee_deduction: '100.00';
            company_contribution: '100.00';
            employee_deduction_annual_maximum: '200.00';
            company_contribution_annual_maximum: '200.00';
            limit_option: null;
            deduct_as_percentage: false;
            contribute_as_percentage: false;
            catch_up: false;
            coverage_amount: null;
            deduction_reduces_taxable_income: null;
            coverage_salary_multiplier: '0.00';
            contribution: {
              type: 'amount';
              value: '100.00';
            };
            elective: false;
          };
          'Tiered Example': {
            id: 1363316536327004;
            version: '09j3d29jqdpj92109j9j2d90dq';
            employee_id: 908123091820398;
            company_benefit_id: 290384923980230;
            active: true;
            employee_deduction: '100.00';
            employee_deduction_annual_maximum: '200.00';
            company_contribution_annual_maximum: '200.00';
            limit_option: null;
            deduct_as_percentage: false;
            catch_up: false;
            coverage_amount: null;
            deduction_reduces_taxable_income: null;
            coverage_salary_multiplier: '0.00';
            elective: true;
            contribution: {
              type: 'tiered';
              value: {
                tiers: [
                  {
                    rate: '100.0';
                    threshold: '2.0';
                    threshold_delta: '2.0';
                  },
                  {
                    rate: '50.0';
                    threshold: '5.0';
                    threshold_delta: '3.0';
                  },
                ];
              };
            };
          };
        };
        properties: {
          id: {
            type: 'number';
            description: 'The ID of the employee benefit.';
            readOnly: true;
          };
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for information on how to use this field.';
            readOnly: true;
          };
          employee_id: {
            type: 'number';
            description: 'The ID of the employee to which the benefit belongs.';
            readOnly: true;
          };
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
            description: 'An object representing the type and value of the company contribution.';
            properties: {
              type: {
                type: 'string';
                description: 'The company contribution scheme.\n\n"amount": The company contributes a fixed amount per payroll. If elective is true, the contribution is matching, dollar-for-dollar.\n\n"percentage": The company contributes a percentage of the payroll amount per payroll period. If elective is true, the contribution is matching, dollar-for-dollar.\n\n"tiered": The company contribution varies according to the size of the employee deduction.';
              };
              value: {
                description: 'For the `amount` and `percentage` contribution types, the value of the corresponding amount or percentage.\n\nFor the `tiered` contribution type, an array of tiers.';
                oneOf: [
                  {
                    type: 'string';
                  },
                  {
                    type: 'object';
                    properties: {
                      tiers: {
                        type: 'array';
                        description: '';
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
                            threshold_delta: {
                              type: 'string';
                              description: "The step up difference between this tier's threshold and the previous tier's threshold. In the first tier, this is equivalent to threshold.";
                            };
                          };
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
            description: 'Whether the company contribution is elective (aka matching). For "tiered" contribution types, this is always true.';
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
            description: 'The amount to be paid, per pay period, by the company. This field will not appear for tiered contribution types.';
            deprecated: true;
          };
          contribute_as_percentage: {
            type: 'boolean';
            default: false;
            description: 'Whether the company_contribution value should be treated as a percentage to be added to each payroll. This field will not appear for tiered contribution types.';
            deprecated: true;
          };
        };
      };
      'Pay-Period': {
        description: 'The representation of a pay period.';
        type: 'object';
        'x-examples': {
          Example: {
            start_date: '2020-01-11';
            end_date: '2020-01-24';
            pay_schedule_id: 1409756036510222;
            pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
            eligible_employees: [
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
              payroll_deadline: '2020-01-28';
            };
          };
        };
        properties: {
          start_date: {
            type: 'string';
            description: 'The start date, inclusive, of the pay period.';
            readOnly: true;
          };
          end_date: {
            type: 'string';
            minLength: 1;
            description: 'The end date, inclusive, of the pay period.';
          };
          pay_schedule_id: {
            type: 'number';
            description: 'The ID of the pay schedule to which the pay period belongs.';
            readOnly: true;
          };
          pay_schedule_uuid: {
            type: 'string';
            description: 'A unique identifier of the pay schedule to which the pay period belongs.';
            readOnly: true;
          };
          eligible_employees: {
            type: 'array';
            uniqueItems: true;
            description: 'The employees who are (or were) eligible during the pay period.';
            items: {
              type: 'object';
              properties: {
                id: {
                  type: 'number';
                  description: 'The ID of the employee that is eligible for the pay period.';
                  readOnly: true;
                };
                job_ids: {
                  type: 'array';
                  uniqueItems: true;
                  description: "The employee's job IDs that are eligible for the pay period.";
                  items: {
                    type: 'number';
                    readOnly: true;
                  };
                  readOnly: true;
                };
              };
              readOnly: true;
            };
            readOnly: true;
          };
          payroll: {
            type: 'object';
            description: 'Information about the payroll for the pay period.';
            properties: {
              processed: {
                type: 'boolean';
                readOnly: true;
                description: 'Whether or not the payroll has been successfully processed. Note that processed payrolls cannot be updated. Additionally, a payroll is not guaranteed to be processed just because the payroll deadline has passed. Late payrolls are not uncommon. Conversely, users may choose to run payroll before the payroll deadline.';
              };
              payroll_deadline: {
                type: 'string';
                description: 'The date by which payroll should be run for employees to be paid on time. Payroll data, such as time and attendance data, should be submitted on or before this date. ';
                readOnly: true;
              };
            };
            readOnly: true;
          };
        };
        'x-tags': ['Payrolls'];
      };
      Payroll: {
        description: '';
        type: 'object';
        'x-examples': {
          Example: {
            version: '19289df18e6e20f797de4a585ea5a91535c7ddf7';
            payroll_deadline: '2021-02-18';
            check_date: '2021-02-22';
            processed: true;
            payroll_id: 7786400908986532;
            payroll_uuid: 'b50e611d-8f3d-4f24-b001-46675f7b5777';
            company_id: 7756341740978008;
            company_uuid: '6bf7807c-a5a0-4f4d-b2e7-3fbb4b2299fb';
            pay_period: {
              start_date: '2021-02-01';
              end_date: '2021-02-15';
              pay_schedule_id: 7757500908984137;
              pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
            };
            totals: {
              company_debit: '121747.71';
              net_pay_debit: '79283.80';
              tax_debit: '42463.91';
              reimbursement_debit: '0.00';
              child_support_debit: '0.00';
              reimbursements: '0.00';
              net_pay: '81752.94';
              gross_pay: '130635.89';
              employee_bonuses: '0.00';
              employee_commissions: '18536.37';
              employee_cash_tips: '0.00';
              employee_paycheck_tips: '0.00';
              additional_earnings: '0.00';
              owners_draw: '0.00';
              check_amount: '2469.14';
              employer_taxes: '6917.19';
              employee_taxes: '35546.72';
              benefits: '0.00';
              employee_benefits_deductions: '13336.23';
              deferred_payroll_taxes: '0.00';
            };
            employee_compensations: [
              {
                employee_id: 1123581321345589;
                excluded: false;
                gross_pay: '2791.25';
                net_pay: '1953.31';
                payment_method: 'Direct Deposit';
                fixed_compensations: [
                  {
                    name: 'Bonus';
                    amount: '100.00';
                    job_id: 1;
                  },
                  {
                    name: 'Reimbursement';
                    amount: '100.00';
                    job_id: 1;
                  },
                ];
                hourly_compensations: [
                  {
                    name: 'Regular Hours';
                    hours: '40.000';
                    job_id: 1;
                    compensation_multiplier: 1;
                  },
                  {
                    name: 'Overtime';
                    hours: '15.000';
                    job_id: 1;
                    compensation_multiplier: 1.5;
                  },
                  {
                    name: 'Double Overtime';
                    hours: '0.000';
                    job_id: 1;
                    compensation_multiplier: 2;
                  },
                  {
                    name: 'Regular Hours';
                    hours: '40.000';
                    job_id: 2;
                    compensation_multiplier: 1;
                  },
                  {
                    name: 'Overtime';
                    hours: '5.000';
                    job_id: 2;
                    compensation_multiplier: 1.5;
                  },
                  {
                    name: 'Double Overtime';
                    hours: '0.000';
                    job_id: 2;
                    compensation_multiplier: 2;
                  },
                ];
                paid_time_off: [
                  {
                    name: 'Vacation Hours';
                    hours: '20.000';
                  },
                  {
                    name: 'Sick Hours';
                    hours: '0.000';
                  },
                  {
                    name: 'Holiday Hours';
                    hours: '0.000';
                  },
                ];
                benefits: [
                  {
                    name: 'Group Term Life';
                    employee_deduction: '100.00';
                    company_contribution: '50.00';
                    imputed: true;
                  },
                  {
                    name: '401K';
                    employee_deduction: '100.00';
                    company_contribution: '50.00';
                    imputed: false;
                  },
                ];
                deductions: [
                  {
                    name: 'Child Support';
                    amount: '80.00';
                  },
                ];
                taxes: [
                  {
                    name: 'Federal Income Tax';
                    employer: false;
                    amount: '646.69';
                  },
                  {
                    name: 'Social Security';
                    employer: true;
                    amount: '191.25';
                  },
                ];
              },
            ];
          };
        };
        'x-tags': ['Payrolls'];
        properties: {
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
            readOnly: true;
          };
          payroll_deadline: {
            type: 'string';
            description: 'The deadline for the payroll to be run in order for employees to be paid on time.';
            readOnly: true;
          };
          check_date: {
            type: 'string';
            description: 'The date on which employees will be paid for the payroll.';
            readOnly: true;
          };
          processed: {
            type: 'boolean';
            description: 'Whether or not the payroll has been successfully processed. Note that processed payrolls cannot be updated. Additionally, a payroll is not guaranteed to be processed just because the payroll deadline has passed. Late payrolls are not uncommon. Conversely, users may choose to run payroll before the payroll deadline.';
            readOnly: true;
          };
          processed_date: {
            type: 'string';
            description: "The date at which the payroll was processed. Null if the payroll isn't processed yet.";
            readOnly: true;
          };
          calculated_at: {
            type: 'string';
            description: "A timestamp of the last valid payroll calculation. Null is there isn't a valid calculation.";
            readOnly: true;
          };
          payroll_id: {
            type: 'number';
            description: 'The ID of the payroll.';
            readOnly: true;
          };
          payroll_uuid: {
            type: 'string';
            description: 'A unique identifier of the payroll.';
            readOnly: true;
          };
          company_id: {
            type: 'number';
            description: 'The ID of the company for the payroll.';
            readOnly: true;
          };
          company_uuid: {
            type: 'string';
            description: 'A unique identifier of the company for the payroll.';
            readOnly: true;
          };
          pay_period: {
            type: 'object';
            properties: {
              start_date: {
                type: 'string';
                description: 'The start date, inclusive, of the pay period.';
                readOnly: true;
              };
              end_date: {
                type: 'string';
                description: 'The start date, inclusive, of the pay period.';
                readOnly: true;
              };
              pay_schedule_id: {
                type: 'number';
                description: 'The ID of the pay schedule for the payroll.';
                readOnly: true;
              };
              pay_schedule_uuid: {
                type: 'string';
                description: 'A unique identifier of the pay schedule for the payroll..';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          totals: {
            type: 'object';
            description: 'The subtotals for the payroll.';
            properties: {
              company_debit: {
                type: 'string';
                description: 'The total company debit for the payroll.';
                readOnly: true;
              };
              net_pay_debit: {
                type: 'string';
                minLength: 1;
                description: 'The total company net pay for the payroll.';
              };
              tax_debit: {
                type: 'string';
                description: 'The total tax debit for the payroll.';
                readOnly: true;
              };
              reimbursement_debit: {
                type: 'string';
                description: 'The total reimbursement debit for the payroll.';
                readOnly: true;
              };
              child_support_debit: {
                type: 'string';
                description: 'The total child support debit for the payroll.';
                readOnly: true;
              };
              reimbursements: {
                type: 'string';
                description: 'The total reimbursements for the payroll.';
                readOnly: true;
              };
              net_pay: {
                type: 'string';
                description: 'The net pay amount for the payroll.';
                readOnly: true;
              };
              gross_pay: {
                type: 'string';
                description: 'The gross pay amount for the payroll.';
                readOnly: true;
              };
              employee_bonuses: {
                type: 'string';
                description: 'The total employee bonuses amount for the payroll.';
                readOnly: true;
              };
              employee_commissions: {
                type: 'string';
                description: 'The total employee commissions amount for the payroll.';
                readOnly: true;
              };
              employee_cash_tips: {
                type: 'string';
                description: 'The total employee cash tips amount for the payroll.';
                readOnly: true;
              };
              employee_paycheck_tips: {
                type: 'string';
                description: 'The total employee paycheck tips amount for the payroll.';
                readOnly: true;
              };
              additional_earnings: {
                type: 'string';
                description: 'The total additional earnings amount for the payroll.';
                readOnly: true;
              };
              owners_draw: {
                type: 'string';
                description: "The total owner's draw for the payroll.";
                readOnly: true;
              };
              check_amount: {
                type: 'string';
                description: 'The total check amount for the payroll.';
                readOnly: true;
              };
              employer_taxes: {
                type: 'string';
                description: 'The total amount of employer paid taxes for the payroll.';
                readOnly: true;
              };
              employee_taxes: {
                type: 'string';
                description: 'The total amount of employee paid taxes for the payroll.';
                readOnly: true;
              };
              benefits: {
                type: 'string';
                description: 'The total amount of company contributed benefits for the payroll.';
                readOnly: true;
              };
              employee_benefits_deductions: {
                type: 'string';
                description: 'The total amount of employee deducted benefits for the payroll.';
                readOnly: true;
              };
              deferred_payroll_taxes: {
                type: 'string';
                description: 'The total amount of payroll taxes deferred for the payroll, such as allowed by the CARES act.';
                readOnly: true;
              };
            };
            readOnly: true;
          };
          employee_compensations: {
            type: 'array';
            uniqueItems: false;
            items: {
              type: 'object';
              properties: {
                employee_id: {
                  type: 'number';
                  description: 'The ID of the employee.';
                  readOnly: true;
                };
                employee_uuid: {
                  type: 'string';
                  description: 'The UUID of the employee.';
                  readOnly: true;
                };
                excluded: {
                  type: 'boolean';
                  description: "This employee will be excluded from payroll calculation and will not be paid for the payroll. Cancelling a payroll would reset all employees' excluded back to false.";
                  readOnly: true;
                };
                gross_pay: {
                  type: 'string';
                  description: "The employee's gross pay. This value is only available for processed payrolls.";
                  nullable: true;
                  readOnly: true;
                };
                net_pay: {
                  type: 'string';
                  description: "The employee's net pay. This value is only available for processed payrolls.";
                  nullable: true;
                  readOnly: true;
                };
                payment_method: {
                  type: 'string';
                  description: "The employee's compensation payment method. This value is only available for processed payrolls.";
                  enum: ['Check', 'Direct Deposit'];
                  nullable: true;
                };
                fixed_compensations: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'An array of fixed compensations for the employee. Fixed compensations include tips, bonuses, and one time reimbursements. If this payroll has been procesed, only fixed compensations with a value greater than 0.00 are returned. For an unprocess payroll, all active fixed compensations are returned.';
                  items: {
                    type: 'object';
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
                        type: 'number';
                        description: 'The ID of the job for the compensation.';
                        readOnly: true;
                      };
                    };
                  };
                };
                hourly_compensations: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'An array of hourly compensations for the employee. Hourly compensations include regular, overtime, and double overtime hours. If this payroll has been procesed, only hourly compensations with a value greater than 0.00 are returned. For an unprocess payroll, all active hourly compensations are returned.';
                  items: {
                    type: 'object';
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
                        type: 'number';
                        description: 'The ID of the job for the compensation.';
                        readOnly: true;
                      };
                      compensation_multiplier: {
                        type: 'number';
                        description: 'The amount multiplied by the base rate to calculate total compensation per hour worked.';
                        readOnly: true;
                      };
                    };
                  };
                };
                paid_time_off: {
                  type: 'array';
                  uniqueItems: false;
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
                benefits: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'An array of employee benefits for the pay period. Benefits are only included for processed payroll when the include parameter is present.';
                  items: {
                    type: 'object';
                    properties: {
                      name: {
                        type: 'string';
                        readOnly: true;
                      };
                      employee_deduction: {
                        type: 'string';
                        readOnly: true;
                      };
                      company_contribution: {
                        type: 'string';
                        readOnly: true;
                      };
                      imputed: {
                        type: 'boolean';
                      };
                    };
                    readOnly: true;
                  };
                  readOnly: true;
                };
                deductions: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'An array of employee deductions for the pay period. Deductions are only included for processed payroll when the include parameter is present.';
                  items: {
                    type: 'object';
                    properties: {
                      name: {
                        type: 'string';
                        readOnly: true;
                      };
                      amount: {
                        type: 'string';
                        readOnly: true;
                      };
                    };
                    readOnly: true;
                  };
                  readOnly: true;
                };
                taxes: {
                  type: 'array';
                  uniqueItems: false;
                  description: 'An array of employer and employee taxes for the pay period. Taxes are only included for processed payroll when the include parameter is present.';
                  items: {
                    type: 'object';
                    properties: {
                      name: {
                        type: 'string';
                        minLength: 1;
                      };
                      employer: {
                        type: 'boolean';
                      };
                      amount: {
                        type: 'string';
                        minLength: 1;
                      };
                    };
                    required: ['name', 'employer', 'amount'];
                    readOnly: true;
                  };
                  readOnly: true;
                };
              };
            };
          };
          payment_speed_changed: {
            type: 'object';
            description: 'Only applicable when a payroll is moved to four day processing instead of fast ach.';
            properties: {
              original_check_date: {
                type: 'string';
                description: 'Original check date when fast ach applies.';
                readOnly: true;
              };
              current_check_date: {
                type: 'string';
                description: 'Current check date.';
                readOnly: true;
              };
              original_debit_date: {
                type: 'number';
                description: 'Original debit date when fast ach applies.';
                readOnly: true;
              };
              current_debit_date: {
                type: 'string';
                description: 'Current check date.';
                readOnly: true;
              };
              reason: {
                type: 'string';
                description: 'The reason why the payroll is moved to four day.';
                readOnly: true;
              };
            };
          };
        };
      };
      'Custom-Field-Type': {
        type: 'string';
        enum: ['text', 'currency', 'number', 'date', 'radio'];
        'x-tags': ['Custom Fields'];
      };
      'Employee-Custom-Field': {
        type: 'object';
        'x-examples': {
          'Employee Level': {
            id: 'ae4e2cd5-e9b6-40f9-88a1-415a02365dd0';
            company_custom_field_id: 'da84500d-d05c-4e4f-bcf2-43152ca33278';
            name: 'employee_level';
            description: 'Employee Level';
            value: '2';
          };
        };
        description: 'A custom field of an employee';
        'x-tags': ['Custom Fields'];
        properties: {
          id: {
            type: 'string';
          };
          company_custom_field_id: {
            type: 'string';
            description: 'This is the id of the response object from when you get the company custom fields';
          };
          name: {
            type: 'string';
          };
          type: {
            $ref: '#/components/schemas/Custom-Field-Type';
          };
          description: {
            type: 'string';
          };
          value: {
            type: 'string';
          };
          selection_options: {
            type: 'array';
            description: 'An array of options for fields of type radio. Otherwise, null.';
            nullable: true;
            items: {
              type: 'string';
            };
          };
        };
        required: ['id', 'company_custom_field_id', 'name', 'type', 'value'];
      };
      'Company-Custom-Field': {
        type: 'object';
        'x-examples': {
          'Employee Level': {
            id: 'ae4e2cd5-e9b6-40f9-88a1-415a02365dd0';
            name: 'employee_level';
            description: 'Employee Level';
          };
        };
        description: 'A custom field on a company';
        'x-tags': ['Custom Fields'];
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          type: {
            $ref: '#/components/schemas/Custom-Field-Type';
          };
          description: {
            type: 'string';
          };
          selection_options: {
            type: 'array';
            description: 'An array of options for fields of type radio. Otherwise, null.';
            nullable: true;
            items: {
              type: 'string';
            };
          };
        };
        required: ['id', 'name', 'type'];
      };
      Signatory: {
        description: "The representation of a company's signatory";
        type: 'object';
        'x-examples': {
          Example: {
            uuid: 'c5fdae57-5483-4529-9aae-f0edceed92d4';
            first_name: 'Jane';
            last_name: 'Smith';
            title: 'Signatory';
          };
        };
        title: 'Signatory';
        'x-tags': ['Signatories'];
        properties: {
          uuid: {
            type: 'string';
          };
          first_name: {
            type: 'string';
            nullable: true;
          };
          last_name: {
            type: 'string';
            nullable: true;
          };
          title: {
            type: 'string';
            nullable: true;
          };
          phone: {
            type: 'string';
            nullable: true;
          };
          email: {
            type: 'string';
          };
          birthday: {
            type: 'string';
            nullable: true;
          };
          is_admin: {
            type: 'boolean';
            description: 'Whether or not the signatory is also the payroll admin of the company.';
          };
          has_ssn: {
            type: 'boolean';
            description: 'Indicates whether the signatory has an SSN in Gusto.';
          };
          version: {
            type: 'string';
            description: 'The current version of the signatory. See the versioning guide for details using this field.';
          };
          identity_verification_status: {
            type: 'string';
            enum: ['Pass', 'Fail', 'Skipped'];
            description: '|   |   |\n|---|---|\n|__Status__| __Description__ |\n| Pass | Signatory can sign all forms |\n| Fail | Signatory cannot sign forms |\n| Skipped | Signatory cannot sign Form 8655 until the form is manually uploaded as wet-signed |\n| null | Identity verification process has not been completed |';
            nullable: true;
          };
          home_address: {
            type: 'object';
            nullable: true;
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
              country: {
                type: 'string';
                default: 'USA';
              };
            };
          };
        };
      };
      Flow: {
        description: 'The representation of a flow in Gusto whitelabel UI.';
        type: 'object';
        'x-examples': {
          Example: {
            url: 'https://flows.gusto-demo.com/flows/lO2BHHAMCScPVV9G5WEURW0Im_nP9mGYloQgjUWbenQ';
            expires_at: '2021-12-28 04:25:48';
          };
        };
        title: 'Flow';
        'x-tags': ['Flows'];
        properties: {
          url: {
            type: 'string';
          };
          expires_at: {
            type: 'string';
          };
        };
      };
      'Employee-Federal-Tax': {
        title: 'Employee-Federal-Tax';
        type: 'object';
        properties: {
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
          };
          filing_status: {
            type: 'string';
            description: 'It determines which tax return form an individual will use and is an important factor in computing taxable income. One of:\n- Single\n- Married\n- Head of Household\n- Exempt from withholding\n- Married, but withhold as Single (does not apply to rev_2020_w4 form)';
          };
          extra_withholding: {
            type: 'string';
            description: 'An employee can request an additional amount to be withheld from each paycheck.';
          };
          two_jobs: {
            type: 'boolean';
            description: 'If there are only two jobs (i.e., you and your spouse each have a job, or you have two), you can set it to true.';
          };
          dependents_amount: {
            type: 'string';
            description: 'A dependent is a person other than the taxpayer or spouse who entitles the taxpayer to claim a dependency exemption.';
          };
          other_income: {
            type: 'string';
            description: 'Other income amount.';
          };
          deductions: {
            type: 'string';
          };
          w4_data_type: {
            type: 'string';
            description: 'The version of w4 form.';
            enum: ['pre_2020_w4', 'rev_2020_w4'];
          };
          federal_withholding_allowance: {
            type: 'string';
            description: '*does not apply to rev_2020_w4 form*\n\nAn exemption from paying a certain amount of income tax.';
          };
          additional_withholding: {
            type: 'boolean';
            description: '*does not apply to rev_2020_w4 form*';
          };
        };
        'x-examples': {
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
        'x-tags': ['Employee Federal Tax'];
      };
      'Employee-State-Tax': {
        title: 'Employee-State-Tax';
        type: 'object';
        'x-examples': {
          'example-1': {
            employee_uuid: '123';
            state: 'CA';
            questions: [
              {
                label: 'Filing Status';
                description: "The Head of Household status applies to unmarried individuals who have a relative living with them in their home. If unsure, read the <a target='_blank' data-bypass rel='noopener noreferrer' tabindex='99' href='https://www.ftb.ca.gov/file/personal/filing-status/index.html'>CA Filing Status explanation</a>.\n";
                key: 'filing_status';
                input_question_format: {
                  type: 'Select';
                  options: [
                    {
                      value: 'S';
                      label: 'Single';
                    },
                    {
                      value: 'M';
                      label: 'Married one income';
                    },
                    {
                      value: 'MD';
                      label: 'Married dual income';
                    },
                    {
                      value: 'H';
                      label: 'Head of household';
                    },
                    {
                      value: 'E';
                      label: 'Do Not Withhold';
                    },
                  ];
                };
                answers: [
                  {
                    value: 'S';
                    valid_from: '2010-01-01';
                    valid_up_to: null;
                  },
                ];
              },
              {
                label: 'Withholding Allowance';
                description: "This value is needed to calculate the employee's CA income tax withholding. If unsure, use the <a target='_blank' data-bypass rel='noopener noreferrer' tabindex='99' href='http://www.edd.ca.gov/pdf_pub_ctr/de4.pdf'>CA DE-4 form</a> to calculate the value manually.\n";
                key: 'withholding_allowance';
                input_question_format: {
                  type: 'Number';
                };
                answers: [
                  {
                    value: 1;
                    valid_from: '2010-01-01';
                    valid_up_to: null;
                  },
                ];
              },
              {
                label: 'Additional Withholding';
                description: 'You can withhold an additional amount of California income taxes here.';
                key: 'additional_withholding';
                input_question_format: {
                  type: 'Currency';
                };
                answers: [
                  {
                    value: '0.0';
                    valid_from: '2010-01-01';
                    valid_up_to: null;
                  },
                ];
              },
            ];
          };
        };
        'x-tags': ['Employee State Tax'];
        properties: {
          employee_uuid: {
            type: 'string';
            description: "The employee's uuid";
          };
          state: {
            type: 'string';
            description: 'Two letter US state abbreviation';
          };
          questions: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Employee-State-Tax-Question';
            };
          };
        };
        required: ['employee_uuid', 'state', 'questions'];
      };
      'Employee-State-Tax-Question': {
        title: 'Employee-State-Tax-Question';
        type: 'object';
        'x-examples': {
          'example-1': {
            label: 'Filing Status';
            description: "The Head of Household status applies to unmarried individuals who have a relative living with them in their home. If unsure, read the <a target='_blank' data-bypass rel='noopener noreferrer' tabindex='99' href='https://www.ftb.ca.gov/file/personal/filing-status/index.html'>CA Filing Status explanation</a>.\n";
            key: 'filing_status';
            input_question_format: {
              type: 'Select';
              options: [
                {
                  value: 'S';
                  label: 'Single';
                },
                {
                  value: 'M';
                  label: 'Married one income';
                },
                {
                  value: 'MD';
                  label: 'Married dual income';
                },
                {
                  value: 'H';
                  label: 'Head of household';
                },
                {
                  value: 'E';
                  label: 'Do Not Withhold';
                },
              ];
            };
            answers: [
              {
                value: 'S';
                valid_from: '2010-01-01';
                valid_up_to: null;
              },
            ];
          };
        };
        'x-tags': ['Employee State Tax'];
        properties: {
          label: {
            type: 'string';
            description: 'A short title for the question';
          };
          description: {
            type: 'string';
            description: 'An explaination of the question - this may contain inline html formatted links.';
          };
          key: {
            type: 'string';
            description: 'A unique identifier of the question (for the given state) - used for updating the answer.';
          };
          input_question_format: {
            $ref: '#/components/schemas/Employee-State-Tax-Input-Question-Format';
          };
          answers: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Employee-State-Tax-Answer';
            };
          };
        };
        required: ['label', 'description', 'key', 'input_question_format', 'answers'];
      };
      'Employee-State-Tax-Answer': {
        title: 'Employee-State-Tax-Answer';
        type: 'object';
        'x-examples': {
          'example-1': {
            value: '0.0';
            valid_from: '2010-01-01';
            valid_up_to: null;
          };
        };
        'x-tags': ['Employee State Tax'];
        properties: {
          value: {
            type: 'string';
            description: 'The answer to the corresponding question - this may be a string, number, boolean, or null.';
          };
          valid_from: {
            type: 'string';
            description: 'The effective date of the answer - currently always “2010-01-01”.';
          };
          valid_up_to: {
            description: 'The effective end date of the answer - currently always null.';
            nullable: true;
          };
        };
      };
      'Employee-State-Tax-Input-Question-Format': {
        title: 'Employee-State-Tax-Input-Question-Format';
        type: 'object';
        'x-examples': {
          'select-example': {
            type: 'Select';
            options: [
              {
                value: 'S';
                label: 'Single';
              },
              {
                value: 'M';
                label: 'Married one income';
              },
              {
                value: 'MD';
                label: 'Married dual income';
              },
              {
                value: 'H';
                label: 'Head of household';
              },
              {
                value: 'E';
                label: 'Do Not Withhold';
              },
            ];
          };
          'number-example': {
            type: 'Number';
          };
        };
        'x-tags': ['Employee State Tax'];
        properties: {
          type: {
            type: 'string';
            description: 'Describes the type of question - Text, Number, Select, Currency';
          };
          options: {
            type: 'array';
            uniqueItems: true;
            description: 'For "Select" type questions, the allowed values and display labels.';
            items: {
              type: 'object';
              properties: {
                value: {
                  description: 'An allowed value to answer the question';
                  type: 'string';
                };
                label: {
                  type: 'string';
                  description: 'A display label that corresponds to the answer value';
                };
              };
              required: ['label'];
            };
          };
        };
        required: ['type'];
      };
      'Federal-Tax-Details': {
        title: 'Federal-Tax-Details';
        type: 'object';
        properties: {
          version: {
            type: 'string';
            description: 'The current version of the object. See the [versioning guide](https://docs.gusto.com/docs/api/ZG9jOjUyNzM0MTc-versioning) for details using this field.';
          };
          tax_payer_type: {
            type: 'string';
            description: 'What type of tax entity the company is. One of:\n- C-Corporation\n- S-Corporation\n- Sole proprietor\n- LLC\n- LLP\n- Limited partnership\n- Co-ownership\n- Association\n- Trusteeship\n- General partnership\n- Joint venture\n- Non-Profit';
          };
          taxable_as_scorp: {
            type: 'string';
            description: 'Whether the company is taxed as an S-Corporation. Tax payer types that may be taxed as an S-Corporation include:\n- S-Corporation\n- C-Corporation\n- LLC';
          };
          filing_form: {
            type: 'string';
            description: 'The form used by the company for federal tax filing. One of:\n- 941 (Quarterly federal tax return form)\n- 944 (Annual federal tax return form)';
          };
          has_ein: {
            type: 'boolean';
            description: "Whether company's Employer Identification Number (EIN) is present";
          };
          ein_verified: {
            type: 'boolean';
            description: 'Whether the EIN was able to be verified as a valid EIN with the IRS. ';
          };
          legal_name: {
            type: 'string';
            description: 'The legal name of the company';
          };
        };
        'x-examples': {
          Example: {
            value: {
              version: 'string';
              tax_payer_type: 'string';
              taxable_as_scorp: 'string';
              filing_form: 'string';
              has_ein: true;
              ein_verified: true;
              legal_name: 'string';
            };
          };
        };
        'x-tags': ['Federal Tax Details'];
      };
      'Employee-Bank-Account': {
        title: 'Employee-Bank-Account';
        type: 'object';
        'x-examples': {
          Example: {
            value: {
              uuid: '1531e824-8d9e-4bd8-9f90-0d04608125d7';
              employee_uuid: '9fcf1b1d-8886-4691-9283-383d3bdd4fd9';
              name: 'BoA Checking Account';
              routing_number: '266905059';
              hidden_account_number: 'XXXX1207';
              account_type: 'Checking';
            };
          };
        };
        properties: {
          uuid: {
            type: 'string';
            description: 'UUID of the bank account';
          };
          employee_uuid: {
            type: 'string';
            description: 'UUID of the employee';
          };
          account_type: {
            type: 'string';
            enum: ['Checking', 'Savings'];
            description: 'Bank account type';
          };
          name: {
            type: 'string';
            description: 'Name for the bank account';
          };
          routing_number: {
            type: 'string';
            description: "The bank account's routing number";
          };
          hidden_account_number: {
            type: 'string';
            description: 'Masked bank account number';
          };
        };
        'x-tags': ['Employee Bank Accounts'];
      };
      'Employee-Payment-Method': {
        title: 'Employee-Payment-Method';
        type: 'object';
        'x-examples': {
          'Example-1': {
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
          'Example-2': {
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
          'Example-3': {
            value: {
              version: '63859768485e218ccf8a449bb60f14ed';
              type: 'Check';
            };
          };
        };
        description: '';
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
            nullable: true;
          };
          splits: {
            type: 'array';
            nullable: true;
            items: {
              type: 'object';
              properties: {
                uuid: {
                  type: 'string';
                  description: 'The bank account ID';
                };
                name: {
                  type: 'string';
                  description: 'The bank account name';
                };
                hidden_account_number: {
                  type: 'string';
                  description: 'Masked bank account number';
                };
                priority: {
                  type: 'integer';
                  description: 'The order of priority for each payment split, with priority 1 being the first bank account paid. Priority must be unique and sequential.';
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
        'x-tags': ['Employee Payment Method'];
      };
    };
    securitySchemes: {
      Authorization: {
        type: 'http';
        scheme: 'bearer';
        description: 'The access token';
      };
    };
    responses: {
      'Employee-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee';
            };
            examples: {
              Example: {
                value: {
                  id: 7757869432666662;
                  uuid: '4b3f930f-82cd-48a8-b797-798686e12e5e';
                  first_name: 'Isom';
                  middle_initial: null;
                  last_name: 'Jaskolski';
                  email: 'dane7757869450111550@botsford.net';
                  company_id: 7756341740978008;
                  company_uuid: 'a007e1ab-3595-43c2-ab4b-af7a5af2e365';
                  manager_id: 7757869432666665;
                  version: '1c7ba9d62c8bafbfff998ffccad5d296';
                  department: null;
                  terminated: false;
                  two_percent_shareholder: false;
                  onboarded: true;
                  jobs: [
                    {
                      id: 7757869441038001;
                      version: '6c0ed1521e8b86eb36bd4455a63a2dac';
                      employee_id: 7757869432666662;
                      current_compensation_id: 7757869444844982;
                      payment_unit: 'Year';
                      primary: true;
                      title: 'Client Support Director';
                      compensations: [
                        {
                          id: 7757869444844982;
                          version: '2cd4b18662395eb53bcf80d5b5447f36';
                          payment_unit: 'Year';
                          flsa_status: 'Exempt';
                          job_id: 7757869441038001;
                          effective_date: '2021-01-20';
                          rate: '70000.00';
                        },
                      ];
                      rate: '70000.00';
                      hire_date: '2020-01-20';
                      location_id: 7757727716657803;
                      location: {
                        id: 7757727716657803;
                        street_1: '412 Kiera Stravenue';
                        street_2: 'Suite 391';
                        city: 'San Francisco';
                        state: 'CA';
                        zip: '94107';
                        country: 'USA';
                        inactive: false;
                      };
                    },
                  ];
                  eligible_paid_time_off: [
                    {
                      name: 'Sick Hours';
                      accrual_unit: 'Hour';
                      accrual_rate: '208.0';
                      accrual_period: 'Year';
                      accrual_balance: '31.8';
                      maximum_accrual_balance: '240.0';
                      paid_at_termination: false;
                    },
                    {
                      name: 'Vacation Hours';
                      accrual_unit: 'Hour';
                      accrual_rate: '208.0';
                      accrual_period: 'Year';
                      accrual_balance: '77.8';
                      maximum_accrual_balance: '240.0';
                      paid_at_termination: true;
                    },
                  ];
                  terminations: [];
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
                  home_address: {
                    version: 'bfc6ed1d49aa9677265232c470fdbc3e';
                    employee_id: 7757869432666662;
                    street_1: '73243 Wuckert Prairie';
                    street_2: 'Suite 189';
                    city: 'San Francisco';
                    state: 'CA';
                    zip: '94107';
                    country: 'USA';
                    active: true;
                  };
                  garnishments: [];
                  date_of_birth: '1986-06-25';
                  has_ssn: false;
                  ssn: '';
                  phone: '1234567890';
                  preferred_first_name: 'Angel';
                  work_email: null;
                };
              };
            };
          };
        };
      };
      'Employee-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Employee';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 7757869432666660;
                    uuid: '9779767c-6044-48e0-bf68-aeb370b9a2e7';
                    first_name: 'Nicole';
                    middle_initial: 'M';
                    last_name: 'Boehm';
                    email: 'kory7757869450111548@barton-hermiston.io';
                    company_id: 7756341740978008;
                    company_uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
                    manager_id: 7757869432666662;
                    version: '414dedaca594b77135e0b8d2f398516d';
                    department: null;
                    terminated: false;
                    two_percent_shareholder: false;
                    onboarded: true;
                    jobs: [
                      {
                        id: 7757869441037999;
                        version: '91179081a7309c9fbd31bb3cf7b9893e';
                        employee_id: 7757869432666660;
                        current_compensation_id: 7757869444844980;
                        payment_unit: 'Hour';
                        primary: true;
                        title: 'Client Support Manager';
                        compensations: [
                          {
                            id: 7757869444844980;
                            version: '233f0096a8015e62d9795fadf1fd300d';
                            payment_unit: 'Hour';
                            flsa_status: 'Nonexempt';
                            job_id: 7757869441037999;
                            effective_date: '2021-01-20';
                            rate: '22.00';
                          },
                        ];
                        rate: '22.00';
                        hire_date: '2020-01-20';
                        location_id: 7757727716657803;
                        location: {
                          id: 7757727716657803;
                          street_1: '412 Kiera Stravenue';
                          street_2: 'Suite 391';
                          city: 'San Francisco';
                          state: 'CA';
                          zip: '94107';
                          country: 'USA';
                          inactive: false;
                        };
                      },
                    ];
                    eligible_paid_time_off: [
                      {
                        name: 'Sick Hours';
                        accrual_unit: 'Hour';
                        accrual_rate: '208.0';
                        accrual_period: 'Year';
                        accrual_balance: '71.0';
                        maximum_accrual_balance: '240.0';
                        paid_at_termination: false;
                      },
                      {
                        name: 'Vacation Hours';
                        accrual_unit: 'Hour';
                        accrual_rate: '208.0';
                        accrual_period: 'Year';
                        accrual_balance: '34.0';
                        maximum_accrual_balance: '240.0';
                        paid_at_termination: true;
                      },
                    ];
                    terminations: [];
                    home_address: {
                      version: '7776defce07496b82f3f1ed469e48ae5';
                      employee_id: 7757869432666660;
                      street_1: '3772 Reynolds Centers';
                      street_2: 'Suite 461';
                      city: 'San Francisco';
                      state: 'CA';
                      zip: '94107';
                      country: 'USA';
                      active: true;
                    };
                    garnishments: [];
                    date_of_birth: '1996-05-08';
                    has_ssn: true;
                    ssn: '';
                    phone: '1234567890';
                    preferred_first_name: 'Vanessa';
                    work_email: null;
                  },
                  {
                    id: 7757869432666661;
                    first_name: 'Maci';
                    middle_initial: 'M';
                    last_name: 'Cassin';
                    email: 'claud_reinger7757869450111549@gutkowski.net';
                    company_id: 7756341740978008;
                    manager_id: 7757869432666665;
                    version: 'e867459e1360fa71e78b88142923d341';
                    department: null;
                    terminated: false;
                    two_percent_shareholder: false;
                    onboarded: true;
                    jobs: [
                      {
                        id: 7757869441038000;
                        version: 'd0e719137f89ca3dd334dd4cc248ffbb';
                        employee_id: 7757869432666661;
                        current_compensation_id: 7757869444844981;
                        payment_unit: 'Year';
                        primary: true;
                        title: 'Account Director';
                        compensations: [
                          {
                            id: 7757869444844981;
                            version: '994b75511d1debac5d7e2ddeae13679f';
                            payment_unit: 'Year';
                            flsa_status: 'Exempt';
                            job_id: 7757869441038000;
                            effective_date: '2021-01-20';
                            rate: '78000.00';
                          },
                        ];
                        rate: '78000.00';
                        hire_date: '2020-01-20';
                        location_id: 7757727716657803;
                        location: {
                          id: 7757727716657803;
                          street_1: '412 Kiera Stravenue';
                          street_2: 'Suite 391';
                          city: 'San Francisco';
                          state: 'CA';
                          zip: '94107';
                          country: 'USA';
                          inactive: false;
                        };
                      },
                    ];
                    eligible_paid_time_off: [
                      {
                        name: 'Sick Hours';
                        accrual_unit: 'Hour';
                        accrual_rate: '208.0';
                        accrual_period: 'Year';
                        accrual_balance: '74.0';
                        maximum_accrual_balance: '240.0';
                        paid_at_termination: false;
                      },
                      {
                        name: 'Vacation Hours';
                        accrual_unit: 'Hour';
                        accrual_rate: '208.0';
                        accrual_period: 'Year';
                        accrual_balance: '16.0';
                        maximum_accrual_balance: '240.0';
                        paid_at_termination: true;
                      },
                    ];
                    terminations: [];
                    home_address: {
                      version: 'b5f18a277987fe9b02230ef36910a248';
                      employee_id: 7757869432666661;
                      street_1: '8078 Bogisich Estate';
                      street_2: 'Suite 892';
                      city: 'San Francisco';
                      state: 'CA';
                      zip: '94107';
                      country: 'USA';
                      active: true;
                    };
                    garnishments: [];
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
                    date_of_birth: '1995-09-21';
                    has_ssn: true;
                    ssn: '';
                    phone: '1234567890';
                    preferred_first_name: 'Denis';
                    work_email: null;
                  },
                ];
              };
            };
          };
        };
      };
      'Company-Onboarding-Status-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Company-Onboarding-Status';
            };
            examples: {
              Example: {
                value: {
                  uuid: 'c44d66dc-c41b-4a60-9e25-5e93ff8583f2';
                  onboarding_completed: false;
                  onboarding_steps: [
                    {
                      title: "Add Your Company's Addresses";
                      id: 'add_addresses';
                      required: true;
                      completed: true;
                      requirements: [];
                    },
                    {
                      title: 'Add Your Employees';
                      id: 'add_employees';
                      required: true;
                      completed: true;
                      requirements: ['add_addresses'];
                    },
                    {
                      title: 'Enter Your Federal Tax Information';
                      id: 'federal_tax_setup';
                      required: true;
                      completed: true;
                      requirements: ['add_addresses', 'add_employees'];
                    },
                    {
                      title: 'Add Your Bank Account';
                      id: 'add_bank_info';
                      required: true;
                      completed: true;
                      requirements: [];
                    },
                    {
                      title: 'Select a Pay Schedule';
                      id: 'payroll_schedule';
                      required: true;
                      completed: false;
                      requirements: [];
                    },
                    {
                      title: 'Sign Documents';
                      id: 'sign_all_forms';
                      required: true;
                      completed: false;
                      requirements: [
                        'add_employees',
                        'federal_tax_setup',
                        'state_setup',
                        'add_bank_info',
                        'payroll_schedule',
                      ];
                    },
                    {
                      title: 'Verify Your Bank Account';
                      id: 'verify_bank_info';
                      required: true;
                      completed: false;
                      requirements: ['add_bank_info'];
                    },
                  ];
                };
              };
            };
          };
        };
      };
      'Company-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Company';
            };
            examples: {
              Example: {
                value: {
                  ein: '00-0000001';
                  entity_type: 'C-Corporation';
                  tier: 'core';
                  is_suspended: false;
                  company_status: 'Approved';
                  id: 7756341740978008;
                  uuid: 'c7a07c73-a703-4462-9343-1b181182b6e0';
                  name: 'Shoppe Studios LLC';
                  trade_name: 'Record Shoppe';
                  locations: [
                    {
                      id: 7757727716657803;
                      street_1: '412 Kiera Stravenue';
                      street_2: 'Suite 391';
                      city: 'San Francisco';
                      state: 'CA';
                      zip: '94107';
                      country: 'USA';
                      active: true;
                    },
                    {
                      id: 7757727716657804;
                      street_1: '644 Fay Vista';
                      street_2: 'Suite 842';
                      city: 'Richmond';
                      state: 'VA';
                      zip: '23218';
                      country: 'USA';
                      active: true;
                    },
                  ];
                  compensations: {
                    hourly: [
                      {
                        name: 'Overtime';
                        multiple: 1.5;
                      },
                      {
                        name: 'Double overtime';
                        multiple: 2;
                      },
                      {
                        name: 'Regular';
                        multiple: 1;
                      },
                      {
                        name: 'Outstanding vacation';
                        multiple: 1;
                      },
                      {
                        name: 'Holiday';
                        multiple: 1;
                      },
                      {
                        name: 'Emergency sick - self care';
                        multiple: 1;
                      },
                      {
                        name: 'Emergency sick - caring for others';
                        multiple: 1;
                      },
                      {
                        name: 'FMLA Public Health Emergency Leave';
                        multiple: 1;
                      },
                      {
                        name: 'Regular Hours';
                        multiple: 1;
                      },
                    ];
                    fixed: [
                      {
                        name: 'Bonus';
                      },
                      {
                        name: 'Commission';
                      },
                      {
                        name: 'Paycheck Tips';
                      },
                      {
                        name: 'Cash Tips';
                      },
                      {
                        name: 'Correction Payment';
                      },
                      {
                        name: 'Severance';
                      },
                      {
                        name: 'Minimum Wage Adjustment';
                      },
                      {
                        name: 'Reimbursement';
                      },
                    ];
                    paid_time_off: [
                      {
                        name: 'Vacation Hours';
                      },
                      {
                        name: 'Sick Hours';
                      },
                      {
                        name: 'Holiday Hours';
                      },
                    ];
                  };
                  primary_signatory: {
                    first_name: 'Alda';
                    middle_initial: '';
                    last_name: 'Carter';
                    phone: '1-565-710-7558';
                    email: 'louie.hessel7757869450111547@zemlak.biz';
                    home_address: {
                      street_1: '524 Roob Divide';
                      street_2: 'Suite 565';
                      city: 'San Francisco';
                      state: 'CA';
                      zip: '94107';
                      country: 'USA';
                    };
                  };
                  primary_payroll_admin: {
                    first_name: 'Ian';
                    last_name: 'Labadie';
                    phone: '1-565-710-7559';
                    email: 'louie.hessel7757869450111547@zemlak.biz';
                  };
                };
              };
            };
          };
        };
      };
      'Signatory-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Signatory';
            };
            examples: {
              Example: {
                value: {
                  uuid: 'c5fdae57-5483-4529-9aae-f0edceed92d4';
                  first_name: 'Jane';
                  last_name: 'Smith';
                  title: 'Signatory';
                };
              };
            };
          };
        };
      };
      'Flow-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Flow';
            };
            examples: {
              Example: {
                value: {
                  url: 'https://flows.gusto-demo.com/flows/lO2BHHAMCScPVV9G5WEURW0Im_nP9mGYloQgjUWbenQ';
                  expires_at: '2021-12-28 04:25:48';
                };
              };
            };
          };
        };
      };
      'Form-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Form';
            };
            examples: {
              Example: {
                value: {
                  uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408';
                  name: 'company_direct_deposit';
                  title: 'Direct Deposit Authorization';
                  description: 'We need you to sign paperwork to authorize us to debit and credit your bank account and file and pay your taxes.';
                  requires_signing: true;
                };
              };
            };
          };
        };
      };
      'Form-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Form';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    uuid: '48cdd5ec-a4dd-4840-a424-ad79f38d8408';
                    name: 'company_direct_deposit';
                    title: 'Direct Deposit Authorization';
                    description: 'We need you to sign paperwork to authorize us to debit and credit your bank account and file and pay your taxes.';
                    requires_signing: true;
                  },
                ];
              };
            };
          };
        };
      };
      'Industry-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Industry';
            };
            examples: {
              Example: {
                value: {
                  company_uuid: '423dd616-6dbc-4724-938a-403f6217a933';
                  naics_code: '611420';
                  sic_codes: ['8243'];
                  title: 'Computer Training';
                };
              };
            };
          };
        };
      };
      'Job-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Job';
            };
            examples: {
              Example: {
                value: {
                  id: 7757869441038000;
                  uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
                  version: 'd0e719137f89ca3dd334dd4cc248ffbb';
                  employee_id: 7757869432666661;
                  employee_uuid: '948daac8-4355-4ece-9e2a-229898accb22';
                  current_compensation_id: 7757869444844981;
                  current_compensation_uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
                  payment_unit: 'Year';
                  primary: true;
                  title: 'Account Director';
                  compensations: [
                    {
                      id: 7757869444844981;
                      uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
                      version: '994b75511d1debac5d7e2ddeae13679f';
                      payment_unit: 'Year';
                      flsa_status: 'Exempt';
                      job_id: 7757869441038000;
                      job_uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
                      effective_date: '2021-01-20';
                      rate: '78000.00';
                    },
                  ];
                  rate: '78000.00';
                  hire_date: '2020-01-20';
                  location_id: 7757727716657803;
                  location: {
                    id: 7757727716657803;
                    street_1: '412 Kiera Stravenue';
                    street_2: 'Suite 391';
                    city: 'San Francisco';
                    state: 'CA';
                    zip: '94107';
                    country: 'USA';
                    inactive: false;
                  };
                };
              };
            };
          };
        };
      };
      'Job-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Job';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 7757869441038001;
                    uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
                    version: '6c0ed1521e8b86eb36bd4455a63a2dac';
                    employee_id: 7757869432666662;
                    employee_uuid: '948daac8-4355-4ece-9e2a-229898accb22';
                    current_compensation_id: 7757869444844982;
                    current_compensation_uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
                    payment_unit: 'Year';
                    primary: true;
                    title: 'Client Support Director';
                    compensations: [
                      {
                        id: 7757869444844982;
                        uuid: 'ea8b0b90-1112-4f9d-bb93-bf029bc8537a';
                        version: '2cd4b18662395eb53bcf80d5b5447f36';
                        payment_unit: 'Year';
                        flsa_status: 'Exempt';
                        job_id: 7757869441038001;
                        job_uuid: 'd6d1035e-8a21-4e1d-89d5-fa894f9aff97';
                        effective_date: '2021-01-20';
                        rate: '70000.00';
                      },
                    ];
                    rate: '70000.00';
                    hire_date: '2020-01-20';
                    location_id: 7757727716657803;
                    location: {
                      id: 7757727716657803;
                      street_1: '412 Kiera Stravenue';
                      street_2: 'Suite 391';
                      city: 'San Francisco';
                      state: 'CA';
                      zip: '94107';
                      country: 'USA';
                      inactive: false;
                    };
                  },
                ];
              };
            };
          };
        };
      };
      'Employee-Federal-Tax-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee-Federal-Tax';
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
                  employee_id: 29;
                  w4_data_type: 'rev_2020_w4';
                };
              };
            };
          };
        };
      };
      'Location-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Location';
            };
            examples: {
              Example: {
                value: {
                  company_id: 7756341740978008;
                  version: '7d9753112507b9dda4fb97910f39b06e';
                  phone_number: '5825710808';
                  id: 7757727716657803;
                  street_1: '412 Kiera Stravenue';
                  street_2: 'Suite 391';
                  city: 'San Francisco';
                  state: 'CA';
                  zip: '94107';
                  country: 'USA';
                  active: true;
                };
              };
            };
          };
        };
      };
      'Location-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Location';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    company_id: 7756341740978008;
                    version: '7d9753112507b9dda4fb97910f39b06e';
                    phone_number: '5825710808';
                    id: 7757727716657803;
                    street_1: '412 Kiera Stravenue';
                    street_2: 'Suite 391';
                    city: 'San Francisco';
                    state: 'CA';
                    zip: '94107';
                    country: 'USA';
                    active: true;
                  },
                  {
                    company_id: 7756341740978008;
                    version: '15e6b9680e00f3122729e64e3cef3224';
                    phone_number: '2866070827';
                    id: 7757727716657804;
                    street_1: '644 Fay Vista';
                    street_2: 'Suite 842';
                    city: 'Richmond';
                    state: 'VA';
                    zip: '23218';
                    country: 'USA';
                    active: true;
                  },
                ];
              };
            };
          };
        };
      };
      'Contractor-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Contractor';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 7757515807594512;
                    company_id: 7757616923763477;
                    wage_type: 'Fixed';
                    is_active: false;
                    version: '63859768485e218ccf8a449bb60f14ed';
                    type: 'Individual';
                    first_name: 'Kory';
                    last_name: 'Gottlieb';
                    middle_initial: 'P';
                    business_name: null;
                    ein: null;
                    email: 'keira.west@mckenzie.org';
                    address: {
                      street_1: '621 Jast Row';
                      street_2: 'Apt. 281';
                      city: 'Coral Springs';
                      state: 'FL';
                      zip: '33065';
                      country: 'USA';
                    };
                    hourly_rate: '0.00';
                  },
                  {
                    id: 7757515807614539;
                    company_id: 7757616923763477;
                    wage_type: 'Fixed';
                    is_active: true;
                    version: '8aab307f1e8ed788697f8986346af559';
                    type: 'Business';
                    first_name: null;
                    last_name: null;
                    middle_initial: null;
                    business_name: 'Labadie-Stroman';
                    ein: 'XX-XXX0001';
                    email: 'jonatan@kerluke.info';
                    address: {
                      street_1: '1625 Bednar Center';
                      street_2: 'Apt. 480';
                      city: 'Port Charlotte';
                      state: 'FL';
                      zip: '33954';
                      country: 'USA';
                    };
                    hourly_rate: '0.00';
                  },
                  {
                    id: 7757515807623484;
                    company_id: 7757616923763477;
                    wage_type: 'Fixed';
                    is_active: true;
                    version: 'b48c46abfed1487b873b442334b3c4ff';
                    type: 'Individual';
                    first_name: 'Chanel';
                    last_name: 'Boyle';
                    middle_initial: 'X';
                    business_name: null;
                    ein: null;
                    email: 'loyal@hettinger.biz';
                    address: {
                      street_1: '35913 Darrick Run';
                      street_2: 'Apt. 913';
                      city: 'Cypress';
                      state: 'TX';
                      zip: '77433';
                      country: 'USA';
                    };
                    hourly_rate: '0.00';
                  },
                ];
              };
            };
          };
        };
      };
      'Contractor-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Contractor';
            };
            examples: {
              'Individual Contractor': {
                value: {
                  id: 7757515807594512;
                  company_id: 7757616923763477;
                  wage_type: 'Fixed';
                  is_active: false;
                  version: '63859768485e218ccf8a449bb60f14ed';
                  type: 'Individual';
                  first_name: 'Kory';
                  last_name: 'Gottlieb';
                  middle_initial: 'P';
                  business_name: null;
                  ein: null;
                  email: 'keira.west@mckenzie.org';
                  address: {
                    street_1: '621 Jast Row';
                    street_2: 'Apt. 281';
                    city: 'Coral Springs';
                    state: 'FL';
                    zip: '33065';
                    country: 'USA';
                  };
                  hourly_rate: '60.00';
                };
              };
              'Business Contractor': {
                value: {
                  id: 7757515807614539;
                  company_id: 7757616923763477;
                  wage_type: 'Fixed';
                  is_active: true;
                  version: '8aab307f1e8ed788697f8986346af559';
                  type: 'Business';
                  first_name: null;
                  last_name: null;
                  middle_initial: null;
                  business_name: 'Labadie-Stroman';
                  ein: 'XX-XXX0001';
                  email: 'jonatan@kerluke.info';
                  address: {
                    street_1: '1625 Bednar Center';
                    street_2: 'Apt. 480';
                    city: 'Port Charlotte';
                    state: 'FL';
                    zip: '33954';
                    country: 'USA';
                  };
                  hourly_rate: '0.00';
                };
              };
            };
          };
        };
      };
      'Contractor-Payments': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Contractor-Payment-Summary';
            };
            examples: {
              Example: {
                value: {
                  total: {
                    reimbursements: '110.0';
                    wages: '1840.0';
                  };
                  contractor_payments: [
                    {
                      contractor_id: 1234;
                      reimbursement_total: '110.0';
                      wage_total: '1840.0';
                      payments: [
                        {
                          bonus: '20.0';
                          date: '2020-10-19';
                          hours: '40.0';
                          payment_method: 'Direct Deposit';
                          reimbursement: '100.0';
                          hourly_rate: '18.0';
                          wage: '0.0';
                          wage_type: 'Hourly';
                          wage_total: '740.00';
                        },
                        {
                          bonus: '100.0';
                          date: '2020-10-19';
                          hours: '0.00';
                          payment_method: 'Direct Deposit';
                          reimbursement: '10.0';
                          hourly_rate: '0.0';
                          wage: '1000.0';
                          wage_type: 'Fixed';
                          wage_total: '1100.0';
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
      'Contractor-Payment-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Contractor-Payment';
            };
            examples: {
              Example: {
                value: {
                  uuid: '04552eb9-7829-4b18-ae96-6983552948df';
                  contractor_id: 7757515807748202;
                  bonus: '20.0';
                  date: '2020-10-19';
                  hours: '40.0';
                  payment_method: 'Direct Deposit';
                  reimbursement: '100.0';
                  hourly_rate: '18.0';
                  wage: '0.0';
                  wage_type: 'Hourly';
                  wage_total: '740.00';
                };
              };
            };
          };
        };
      };
      'Compensation-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Compensation';
            };
            examples: {
              Example: {
                value: {
                  id: 1363316536327004;
                  uuid: 'db57832c-d8bc-43a7-ae99-0a04480ff037';
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                  job_id: 1123581321345589;
                  job_uuid: 'd8f8fbe7-496d-4b69-86f0-1e2d1b73a086';
                  rate: '70.00';
                  payment_unit: 'Hour';
                  flsa_status: 'Nonexempt';
                  effective_date: '2020-12-11';
                };
              };
            };
          };
          'application/xml': {
            schema: {
              type: 'object';
              properties: {};
            };
          };
        };
      };
      'Compensation-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Compensation';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1363316536327004;
                    uuid: 'db57832c-d8bc-43a7-ae99-0a04480ff037';
                    version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                    job_id: 1123581321345589;
                    job_uuid: 'd8f8fbe7-496d-4b69-86f0-1e2d1b73a086';
                    rate: '70.00';
                    payment_unit: 'Hour';
                    flsa_status: 'Nonexempt';
                    effective_date: '2020-12-11';
                  },
                ];
              };
            };
          };
        };
      };
      'Garnishment-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Garnishment';
            };
            examples: {
              Example: {
                value: {
                  id: 1363316538400333;
                  version: '52b7c567242cb7452e89ba2bc02cb476';
                  employee_id: 8964216891236743;
                  active: true;
                  amount: '8.00';
                  description: 'Company loan to employee';
                  court_ordered: false;
                  times: 5;
                  recurring: false;
                  annual_maximum: null;
                  pay_period_maximum: '100.00';
                  deduct_as_percentage: true;
                };
              };
            };
          };
        };
      };
      'Garnishment-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Garnishment';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1363316536327000;
                    version: '63152767c822d6b0385509b973c49dda';
                    employee_id: 8964216891236743;
                    active: true;
                    amount: '100.00';
                    description: 'Child support';
                    court_ordered: true;
                    times: null;
                    recurring: true;
                    annual_maximum: '400.00';
                    pay_period_maximum: null;
                    deduct_as_percentage: false;
                  },
                  {
                    id: 1363316538400333;
                    version: '52b7c567242cb7452e89ba2bc02cb476';
                    employee_id: 8964216891236743;
                    active: true;
                    amount: '8.00';
                    description: 'Company loan to employee';
                    court_ordered: false;
                    times: 5;
                    recurring: false;
                    annual_maximum: null;
                    pay_period_maximum: '100.00';
                    deduct_as_percentage: true;
                  },
                ];
              };
            };
          };
        };
      };
      'Termination-Object': {
        description: '';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Termination';
            };
            examples: {
              Example: {
                value: {
                  id: 891238902131212;
                  version: 'd487dd0b55dfcacdd920ccbdaeafa351';
                  active: true;
                  effective_date: '2020-03-10';
                  run_termination_payroll: false;
                };
              };
            };
          };
        };
      };
      'Termination-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Termination';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 891238902131212;
                    version: 'd487dd0b55dfcacdd920ccbdaeafa351';
                    active: true;
                    effective_date: '2020-03-10';
                    run_termination_payroll: false;
                  },
                ];
              };
            };
          };
        };
      };
      'Time-Off-Request-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Time-Off-Request';
            };
            examples: {
              Example: {
                value: {
                  id: 1;
                  status: 'approved';
                  employee_note: 'Vacation at Disney World!';
                  employer_note: 'But Universal has Harry Potter World...';
                  days: {
                    '2019-06-01': '4.000';
                    '2019-06-02': '8.000';
                    '2019-06-03': '2.000';
                  };
                  request_type: 'vacation';
                  employee: {
                    id: '234567';
                    full_name: 'Jessica Gusto';
                  };
                  approver: {
                    id: '345678';
                    full_name: 'Karen Gusto';
                  };
                  initiator: {
                    id: '234567';
                    full_name: 'Jessica Gusto';
                  };
                };
              };
            };
          };
        };
      };
      'Time-Off-Request-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Time-Off-Request';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1;
                    status: 'approved';
                    employee_note: 'Vacation at Disney World!';
                    employer_note: 'But Universal has Harry Potter World...';
                    days: {
                      '2019-06-01': '4.000';
                      '2019-06-02': '8.000';
                      '2019-06-03': '2.000';
                    };
                    request_type: 'vacation';
                    employee: {
                      id: '234567';
                      full_name: 'Jessica Gusto';
                    };
                    approver: {
                      id: '345678';
                      full_name: 'Karen Gusto';
                    };
                    initiator: {
                      id: '234567';
                      full_name: 'Jessica Gusto';
                    };
                  },
                  {
                    id: 2;
                    status: 'pending';
                    employee_note: 'Coming down with the flu';
                    employer_note: '';
                    days: {
                      '2019-02-01': '8.000';
                    };
                    request_type: 'sick';
                    employee: {
                      id: '654321';
                      full_name: 'James Gusto';
                    };
                    approver: null;
                    initiator: {
                      id: '654321';
                      full_name: 'James Gusto';
                    };
                  },
                ];
              };
            };
          };
        };
      };
      'Pay-Schedule-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Pay-Schedule';
            };
            examples: {
              Example: {
                value: {
                  id: 1;
                  uuid: 'f2a69c38-e2f9-4e31-b5c5-4754fc60a052';
                  frequency: 'Twice per month';
                  anchor_pay_date: '2020-05-15';
                  day_1: 15;
                  day_2: 31;
                  name: 'Engineering';
                  auto_pilot: false;
                };
              };
            };
          };
        };
      };
      'Pay-Schedule-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Pay-Schedule';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1;
                    uuid: '2097fe08-407a-46d7-b35c-a32402a2355e';
                    frequency: 'Twice per month';
                    anchor_pay_date: '2020-05-15';
                    day_1: 15;
                    day_2: 31;
                    name: 'Engineering';
                    auto_pilot: false;
                  },
                  {
                    id: 2;
                    uuid: '8fc9f556-74fa-4271-97f6-4bfbfc5a5352';
                    frequency: 'Monthly';
                    anchor_pay_date: '2020-05-31';
                    day_1: 31;
                    day_2: null;
                    name: 'Sales';
                    auto_pilot: false;
                  },
                  {
                    id: 3;
                    uuid: '0e07d35a-af11-4123-bfcb-4dd5f2f12ee1';
                    frequency: 'Monthly';
                    anchor_pay_date: '2020-05-31';
                    day_1: 31;
                    day_2: null;
                    name: 'Staff';
                    auto_pilot: true;
                  },
                ];
              };
            };
          };
        };
      };
      'Supported-Benefit-Object': {
        description: 'Supported benefit response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Supported-Benefit';
            };
            examples: {
              Example: {
                value: {
                  id: 1;
                  name: 'Medical Insurance';
                  description: 'Deductions and contributions for Medical Insurance';
                  pretax: true;
                  posttax: false;
                  imputed: false;
                  healthcare: true;
                  retirement: false;
                  yearly_limit: false;
                };
              };
            };
          };
        };
      };
      'Supported-Benefit-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Supported-Benefit';
              };
            };
            examples: {
              'Supported Benefits': {
                value: [
                  {
                    id: 1;
                    name: 'Medical Insurance';
                    description: 'Deductions and contributions for Medical Insurance';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: true;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 2;
                    name: 'Dental Insurance';
                    description: 'Deductions and contributions for Dental Insurance';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: true;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 3;
                    name: 'Vision Insurance';
                    description: 'Deductions and contributions for Vision Insurance';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: true;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 6;
                    name: 'Health Savings Account';
                    description: "Health Savings Accounts (HSA) allow employees to be reimbursed for qualified medical expenses. Contributions are pre-tax and lower the total amount of tax paid by employees and the employer. Employers may also make tax-free contributions to employees' HSA. Remaining balances are carried over in next year.";
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: true;
                  },
                  {
                    id: 7;
                    name: 'Health FSA';
                    description: "Flexible Spending Accounts (FSA) allow employees to be reimbursed for qualified medical expenses. Contributions are pre-tax and lower the total amount of tax paid by employees and the employer. Employers may also make tax-free contributions to employees' FSA. Remaining balances are not carried over in next year.";
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: true;
                  },
                  {
                    id: 11;
                    name: 'Dependent Care FSA';
                    description: 'translation missing: api-en.v1.benefits.descriptions.11';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: true;
                  },
                  {
                    id: 8;
                    name: 'SIMPLE IRA';
                    description: "The SIMPLE IRA is a tax-deferred retirement savings plan for employees. It is often used by small businesses as an alternative to 401(k) due to its relatively low operating cost. Employers are required to contribute a specific percentage to an employee's SIMPLE IRA.";
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 105;
                    name: 'Roth 401(k)';
                    description: 'Roth 401(k) is an after-tax savings plan for employees. The standard maximum is $18,000, or $24,000 for employees over 50 years old.';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 110;
                    name: 'Roth 403(b)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.110';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 5;
                    name: '401(k)';
                    description: '401(k) is tax-deferred retirement savings plan for employees. The standard maximum is $18,000, or $24,000 for employees over 50 years old.';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 9;
                    name: '403(b)';
                    description: '403(b) is tax-deferred retirement savings plan for certain clerics, employees of public schools, and employees of other types of tax-exempt organizations.';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 108;
                    name: 'SEP-IRA';
                    description: 'translation missing: api-en.v1.benefits.descriptions.108';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 109;
                    name: 'SARSEP';
                    description: 'translation missing: api-en.v1.benefits.descriptions.109';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: true;
                    yearly_limit: true;
                  },
                  {
                    id: 107;
                    name: 'Group-Term Life Insurance';
                    description: 'Group-Term Life Insurance for coverage in excess of $50,000 per employee is a taxable fringe benefit. See IRS Publication 15-B to determine the dollar value of the excess coverage.';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 10;
                    name: 'Commuter Benefits (pre-tax)';
                    description: 'Tax-free commuter benefits for transit, vanpooling, bicycling, and work-related parking costs. The annual maximum contribution for this pre-tax benefit is in the IRS publication 15-B.';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 106;
                    name: 'Personal Use of Company Car';
                    description: 'When an employee uses a company-owned car for personal matters, it is considered taxable benefit provided in-kind.';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 111;
                    name: '529 College Savings';
                    description: '529 College Savings is an after-tax savings plan for employees designed to encourage saving for future college costs. This benefit should be reported as a taxable benefit and will therefore be taxed.';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 112;
                    name: 'Student Loan Repayment';
                    description: 'Student Loan Repayment is an after-tax savings plan for employees to pay towards their outstanding student loans. An employee can choose to set aside after-tax dollars towards this benefit. These benefits should be reported as a taxable benefit and will therefore be taxed.';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 998;
                    name: 'Short Term Disability (post-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.998';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 999;
                    name: 'Long Term Disability (post-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.999';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 996;
                    name: 'Short Term Disability (pre-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.996';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 997;
                    name: 'Long Term Disability (pre-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.997';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 991;
                    name: 'Voluntary Short Term Disability (post-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.991';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 992;
                    name: 'Voluntary Long Term Disability (post-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.992';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 993;
                    name: 'Voluntary Life (post-tax)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.993';
                    pretax: false;
                    posttax: true;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 113;
                    name: 'Commuter Parking';
                    description: 'translation missing: api-en.v1.benefits.descriptions.113';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 114;
                    name: 'Commuter Transit';
                    description: 'translation missing: api-en.v1.benefits.descriptions.114';
                    pretax: true;
                    posttax: false;
                    imputed: false;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 100;
                    name: 'Other (taxable)';
                    description: 'Other taxable benefit';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 201;
                    name: 'Cell Phone (taxable)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.201';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 202;
                    name: 'Gym & Fitness (taxable)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.202';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 203;
                    name: 'Housing (taxable)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.203';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                  {
                    id: 204;
                    name: 'Wellness (taxable)';
                    description: 'translation missing: api-en.v1.benefits.descriptions.204';
                    pretax: false;
                    posttax: true;
                    imputed: true;
                    healthcare: false;
                    retirement: false;
                    yearly_limit: false;
                  },
                ];
              };
            };
          };
        };
      };
      'Admin-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Admin';
            };
            examples: {
              Example: {
                value: {
                  first_name: 'John';
                  last_name: 'Smith';
                  email: 'jsmith99@gmail.com';
                  uuid: '5de11791-98fd-4587-9ed0-d5d804b8e647';
                };
              };
            };
          };
        };
      };
      'Admin-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Admin';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    first_name: 'Katherine';
                    last_name: 'Johnson';
                    email: 'Katherine@acmecorp.com';
                    uuid: '987058cc-23ee-46e9-81ef-5cee086cceca';
                  },
                  {
                    first_name: 'Anita';
                    last_name: 'Borg';
                    email: 'Anita@acmecorp.com';
                    uuid: '5de11791-98fd-4587-9ed0-d5d804b8e647';
                  },
                ];
              };
            };
          };
        };
      };
      'Company-Benefit-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Company-Benefit';
            };
            examples: {
              Example: {
                value: {
                  id: 1363316536327004;
                  version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                  company_id: 1363316537128394;
                  benefit_id: 1;
                  active: true;
                  description: 'Kaiser Permanente';
                  supports_percentage_amounts: true;
                  responsible_for_employer_taxes: false;
                  responsible_for_employee_w2: false;
                };
              };
            };
          };
        };
      };
      'Company-Benefit-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Company-Benefit';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1363316536327004;
                    version: '98jr3289h3298hr9329gf9egskt3kagri32qqgiqe3872';
                    company_id: 1363316537128394;
                    benefit_id: 1;
                    active: true;
                    description: 'Kaiser Permanente';
                    supports_percentage_amounts: true;
                    responsible_for_employer_taxes: false;
                    responsible_for_employee_w2: false;
                  },
                ];
              };
            };
          };
        };
      };
      'Earning-Type-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                default: {
                  type: 'array';
                  description: 'The default earning types for the company.';
                  items: {
                    $ref: '#/components/schemas/Earning-Type';
                  };
                };
                custom: {
                  type: 'array';
                  description: 'The custom earning types for the company.';
                  items: {
                    $ref: '#/components/schemas/Earning-Type';
                  };
                };
              };
            };
            examples: {
              Example: {
                value: {
                  default: [
                    {
                      name: 'Bonus';
                      uuid: 'b82e35c5-d7c6-4705-9e16-9f87499ade18';
                    },
                    {
                      name: 'Cash Tips';
                      uuid: 'f5618c94-ed7d-4366-b2c4-ff05e430064f';
                    },
                    {
                      name: 'Commission';
                      uuid: '60191999-004a-49d9-b163-630574433653';
                    },
                    {
                      name: 'Correction Payment';
                      uuid: '368226e0-8e8c-48f0-bc91-aee46caafbc9';
                    },
                    {
                      name: 'Minimum Wage Adjustment';
                      uuid: '88a2e519-9ff5-4c19-9071-6a709f3c2939';
                    },
                    {
                      name: 'Paycheck Tips';
                      uuid: 'a3eaf03d-e712-4144-8f9b-71a85528adcf';
                    },
                    {
                      name: 'Severance';
                      uuid: 'a6a2eba7-6c7d-4ced-bbe8-43452fbc9f63';
                    },
                  ];
                  custom: [
                    {
                      name: 'Gym Membership Stipend';
                      uuid: '6b4a8efb-db90-4c13-a75f-aae11b3f4ff9';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      'Earning-Type-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Earning-Type';
            };
            examples: {
              Example: {
                value: {
                  name: 'Gym Membership Stipend';
                  uuid: 'f4dc8972-8830-4c07-b623-349a04b040d7';
                };
              };
            };
          };
        };
      };
      'Employee-Benefit-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee-Benefit';
            };
            examples: {
              Example: {
                value: {
                  id: 1363316536327004;
                  version: '09j3d29jqdpj92109j9j2d90dq';
                  employee_id: 908123091820398;
                  company_benefit_id: 290384923980230;
                  active: true;
                  employee_deduction: '100.00';
                  employee_deduction_annual_maximum: '200.00';
                  company_contribution_annual_maximum: '200.00';
                  limit_option: null;
                  deduct_as_percentage: false;
                  catch_up: false;
                  coverage_amount: null;
                  deduction_reduces_taxable_income: null;
                  coverage_salary_multiplier: '0.00';
                  contribution: {
                    type: 'amount';
                    value: '100.00';
                  };
                };
              };
              'Tiered example': {
                value: {
                  id: 0;
                  version: 'string';
                  employee_id: 0;
                  company_benefit_id: 0;
                  active: true;
                  employee_deduction: '0.00';
                  deduct_as_percentage: false;
                  employee_deduction_annual_maximum: 'string';
                  contribution: {
                    type: 'tiered';
                    value: {
                      tiers: [
                        {
                          rate: '5.0';
                          threshold: '2.0';
                          threshold_delta: '2.0';
                        },
                        {
                          rate: '3.0';
                          threshold: '5.0';
                          threshold_delta: '3.0';
                        },
                      ];
                    };
                  };
                  elective: false;
                  company_contribution_annual_maximum: 'string';
                  limit_option: 'string';
                  catch_up: false;
                  coverage_amount: 'string';
                  deduction_reduces_taxable_income: 'unset';
                  coverage_salary_multiplier: '0.00';
                };
              };
            };
          };
        };
      };
      'Employee-Benefit-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Employee-Benefit';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    id: 1363316536327004;
                    version: '09j3d29jqdpj92109j9j2d90dq';
                    employee_id: 908123091820398;
                    company_benefit_id: 290384923980230;
                    active: true;
                    employee_deduction: '100.00';
                    company_contribution: '100.00';
                    employee_deduction_annual_maximum: '200.00';
                    company_contribution_annual_maximum: '200.00';
                    limit_option: null;
                    deduct_as_percentage: false;
                    contribute_as_percentage: false;
                    catch_up: false;
                    coverage_amount: null;
                    deduction_reduces_taxable_income: null;
                    coverage_salary_multiplier: '0.00';
                  },
                ];
              };
            };
          };
        };
      };
      'Payroll-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Payroll';
            };
            examples: {
              Example: {
                value: {
                  version: '19289df18e6e20f797de4a585ea5a91535c7ddf7';
                  payroll_deadline: '2021-02-18';
                  check_date: '2021-02-22';
                  processed: true;
                  processed_date: '2021-02-18';
                  payroll_id: 7786400908986532;
                  payroll_uuid: 'b50e611d-8f3d-4f24-b001-46675f7b5777';
                  company_id: 7756341740978008;
                  company_uuid: '6bf7807c-a5a0-4f4d-b2e7-3fbb4b2299fb';
                  pay_period: {
                    start_date: '2021-02-01';
                    end_date: '2021-02-15';
                    pay_schedule_id: 7757500908984137;
                    pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                  };
                  totals: {
                    company_debit: '121747.71';
                    net_pay_debit: '79283.80';
                    tax_debit: '42463.91';
                    reimbursement_debit: '0.00';
                    child_support_debit: '0.00';
                    reimbursements: '0.00';
                    net_pay: '81752.94';
                    gross_pay: '130635.89';
                    employee_bonuses: '0.00';
                    employee_commissions: '18536.37';
                    employee_cash_tips: '0.00';
                    employee_paycheck_tips: '0.00';
                    additional_earnings: '0.00';
                    owners_draw: '0.00';
                    check_amount: '2469.14';
                    employer_taxes: '6917.19';
                    employee_taxes: '35546.72';
                    benefits: '0.00';
                    employee_benefits_deductions: '13336.23';
                    deferred_payroll_taxes: '0.00';
                  };
                  employee_compensations: [
                    {
                      employee_id: 1123581321345589;
                      excluded: false;
                      gross_pay: '2791.25';
                      net_pay: '1953.31';
                      payment_method: 'Direct Deposit';
                      fixed_compensations: [
                        {
                          name: 'Bonus';
                          amount: '100.00';
                          job_id: 1;
                        },
                        {
                          name: 'Reimbursement';
                          amount: '100.00';
                          job_id: 1;
                        },
                      ];
                      hourly_compensations: [
                        {
                          name: 'Regular Hours';
                          hours: '40.000';
                          job_id: 1;
                          compensation_multiplier: 1;
                        },
                        {
                          name: 'Overtime';
                          hours: '15.000';
                          job_id: 1;
                          compensation_multiplier: 1.5;
                        },
                        {
                          name: 'Double overtime';
                          hours: '0.000';
                          job_id: 1;
                          compensation_multiplier: 2;
                        },
                        {
                          name: 'Regular Hours';
                          hours: '40.000';
                          job_id: 2;
                          compensation_multiplier: 1;
                        },
                        {
                          name: 'Overtime';
                          hours: '5.000';
                          job_id: 2;
                          compensation_multiplier: 1.5;
                        },
                        {
                          name: 'Double overtime';
                          hours: '0.000';
                          job_id: 2;
                          compensation_multiplier: 2;
                        },
                      ];
                      paid_time_off: [
                        {
                          name: 'Vacation Hours';
                          hours: '20.000';
                        },
                        {
                          name: 'Sick Hours';
                          hours: '0.000';
                        },
                        {
                          name: 'Holiday Hours';
                          hours: '0.000';
                        },
                      ];
                      benefits: [
                        {
                          name: 'Group Term Life';
                          employee_deduction: '100.00';
                          company_contribution: '50.00';
                          imputed: true;
                        },
                        {
                          name: '401K';
                          employee_deduction: '100.00';
                          company_contribution: '50.00';
                          imputed: false;
                        },
                      ];
                      deductions: [
                        {
                          name: 'Child Support';
                          amount: '80.00';
                        },
                      ];
                      taxes: [
                        {
                          name: 'Federal Income Tax';
                          employer: false;
                          amount: '646.69';
                        },
                        {
                          name: 'Social Security';
                          employer: true;
                          amount: '191.25';
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
      'Payroll-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Payroll';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    version: '19289df18e6e20f797de4a585ea5a91535c7ddf7';
                    payroll_deadline: '2021-02-18';
                    check_date: '2021-02-22';
                    processed: true;
                    processed_date: '2021-02-18';
                    payroll_id: 7786400908986532;
                    payroll_uuid: 'b50e611d-8f3d-4f24-b001-46675f7b5777';
                    company_id: 7756341740978008;
                    company_uuid: '6bf7807c-a5a0-4f4d-b2e7-3fbb4b2299fb';
                    pay_period: {
                      start_date: '2021-02-01';
                      end_date: '2021-02-15';
                      pay_schedule_id: 7757500908984137;
                      pay_schedule_uuid: '00ebc4a4-ec88-4435-8f45-c505bb63e501';
                    };
                    totals: {
                      company_debit: '121747.71';
                      net_pay_debit: '79283.80';
                      tax_debit: '42463.91';
                      reimbursement_debit: '0.00';
                      child_support_debit: '0.00';
                      reimbursements: '0.00';
                      net_pay: '81752.94';
                      gross_pay: '130635.89';
                      employee_bonuses: '0.00';
                      employee_commissions: '18536.37';
                      employee_cash_tips: '0.00';
                      employee_paycheck_tips: '0.00';
                      additional_earnings: '0.00';
                      owners_draw: '0.00';
                      check_amount: '2469.14';
                      employer_taxes: '6917.19';
                      employee_taxes: '35546.72';
                      benefits: '0.00';
                      employee_benefits_deductions: '13336.23';
                      deferred_payroll_taxes: '0.00';
                    };
                    employee_compensations: [
                      {
                        employee_id: 1123581321345589;
                        excluded: false;
                        gross_pay: '2791.25';
                        net_pay: '1953.31';
                        payment_method: 'Direct Deposit';
                        fixed_compensations: [
                          {
                            name: 'Bonus';
                            amount: '100.00';
                            job_id: 1;
                          },
                          {
                            name: 'Reimbursement';
                            amount: '100.00';
                            job_id: 1;
                          },
                        ];
                        hourly_compensations: [
                          {
                            name: 'Regular Hours';
                            hours: '40.000';
                            job_id: 1;
                            compensation_multiplier: 1;
                          },
                          {
                            name: 'Overtime';
                            hours: '15.000';
                            job_id: 1;
                            compensation_multiplier: 1.5;
                          },
                          {
                            name: 'Double Overtime';
                            hours: '0.000';
                            job_id: 1;
                            compensation_multiplier: 2;
                          },
                          {
                            name: 'Regular Hours';
                            hours: '40.000';
                            job_id: 2;
                            compensation_multiplier: 1;
                          },
                          {
                            name: 'Overtime';
                            hours: '5.000';
                            job_id: 2;
                            compensation_multiplier: 1.5;
                          },
                          {
                            name: 'Double Overtime';
                            hours: '0.000';
                            job_id: 2;
                            compensation_multiplier: 2;
                          },
                        ];
                        paid_time_off: [
                          {
                            name: 'Vacation Hours';
                            hours: '20.000';
                          },
                          {
                            name: 'Sick Hours';
                            hours: '0.000';
                          },
                          {
                            name: 'Holiday Hours';
                            hours: '0.000';
                          },
                        ];
                        benefits: [
                          {
                            name: 'Group Term Life';
                            employee_deduction: '100.00';
                            company_contribution: '50.00';
                            imputed: true;
                          },
                          {
                            name: '401K';
                            employee_deduction: '100.00';
                            company_contribution: '50.00';
                            imputed: false;
                          },
                        ];
                        deductions: [
                          {
                            name: 'Child Support';
                            amount: '80.00';
                          },
                        ];
                        taxes: [
                          {
                            name: 'Federal Income Tax';
                            employer: false;
                            amount: '646.69';
                          },
                          {
                            name: 'Social Security';
                            employer: true;
                            amount: '191.25';
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
      'Payment-Configs-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Payment-Configs';
            };
            examples: {
              Example: {
                value: {
                  company_uuid: '423dd616-6dbc-4724-938a-403f6217a933';
                  partner_uuid: '556f05d0-48e0-4c47-bce5-db9aea923043';
                  fast_payment_limit: 5000;
                  payment_speed: '2-day';
                };
              };
            };
          };
        };
      };
      'Company-Bank-Account-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Company-Bank-Account';
            };
            examples: {
              Example: {
                value: {
                  uuid: '1263eae5-4411-48d9-bd6d-18ed93082e65';
                  company_uuid: 'e2c4c0ce-2986-48b9-86cf-ec27f6ed9a36';
                  account_type: 'Checking';
                  routing_number: '851070439';
                  account_number: 'XXXX4087';
                  verification_status: 'verified';
                  verification_type: 'bank_deposits';
                };
              };
            };
          };
        };
      };
      'Company-Bank-Account-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Company-Bank-Account';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    uuid: '1263eae5-4411-48d9-bd6d-18ed93082e65';
                    company_uuid: 'e2c4c0ce-2986-48b9-86cf-ec27f6ed9a36';
                    account_type: 'Checking';
                    routing_number: '851070439';
                    hidden_account_number: 'XXXX4087';
                    verification_status: 'verified';
                    verification_type: 'bank_deposits';
                  },
                ];
              };
            };
          };
        };
      };
      'Employee-Bank-Account-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee-Bank-Account';
            };
            examples: {
              Example: {
                value: {
                  uuid: '1531e824-8d9e-4bd8-9f90-0d04608125d7';
                  employee_uuid: '9fcf1b1d-8886-4691-9283-383d3bdd4fd9';
                  name: 'BoA Checking Account';
                  routing_number: '266905059';
                  hidden_account_number: 'XXXX1207';
                  account_type: 'Checking';
                };
              };
            };
          };
        };
      };
      'Employee-Bank-Account-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Employee-Bank-Account';
              };
            };
            examples: {
              Example: {
                value: [
                  {
                    uuid: '1531e824-8d9e-4bd8-9f90-0d04608125d7';
                    employee_uuid: '9fcf1b1d-8886-4691-9283-383d3bdd4fd9';
                    name: 'BoA Checking Account';
                    routing_number: '266905059';
                    hidden_account_number: 'XXXX1207';
                    account_type: 'Checking';
                  },
                ];
              };
            };
          };
        };
      };
      'Employee-Payment-Method-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee-Payment-Method';
            };
          };
        };
      };
      'Federal-Tax-Details-Object': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Federal-Tax-Details';
            };
          };
        };
      };
      'Employee-State-Taxes-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Employee-State-Tax';
              };
            };
            examples: {
              'Employee-State-Taxes-List-Example': {
                value: {
                  employee_uuid: '92fa4d30-e284-43d0-a26e-605619c04beb';
                  state: 'CA';
                  questions: [
                    {
                      label: 'Filing Status';
                      description: "The Head of Household status applies to unmarried individuals who have a relative living with them in their home. If unsure, read the <a target='_blank' data-bypass rel='noopener noreferrer' tabindex='99' href='https://www.ftb.ca.gov/file/personal/filing-status/index.html'>CA Filing Status explanation</a>.\n";
                      key: 'filing_status';
                      input_question_format: {
                        type: 'Select';
                        options: [
                          {
                            value: 'S';
                            label: 'Single';
                          },
                          {
                            value: 'M';
                            label: 'Married one income';
                          },
                          {
                            value: 'MD';
                            label: 'Married dual income';
                          },
                          {
                            value: 'H';
                            label: 'Head of household';
                          },
                          {
                            value: 'E';
                            label: 'Do Not Withhold';
                          },
                        ];
                      };
                      answers: [
                        {
                          value: 'S';
                          valid_from: '2010-01-01';
                          valid_up_to: null;
                        },
                      ];
                    },
                    {
                      label: 'Withholding Allowance';
                      description: "This value is needed to calculate the employee's CA income tax withholding. If unsure, use the <a target='_blank' data-bypass rel='noopener noreferrer' tabindex='99' href='http://www.edd.ca.gov/pdf_pub_ctr/de4.pdf'>CA DE-4 form</a> to calculate the value manually.\n";
                      key: 'withholding_allowance';
                      input_question_format: {
                        type: 'Number';
                      };
                      answers: [
                        {
                          value: 1;
                          valid_from: '2010-01-01';
                          valid_up_to: null;
                        },
                      ];
                    },
                    {
                      label: 'Additional Withholding';
                      description: 'You can withhold an additional amount of California income taxes here.';
                      key: 'additional_withholding';
                      input_question_format: {
                        type: 'Currency';
                      };
                      answers: [
                        {
                          value: '0.0';
                          valid_from: '2010-01-01';
                          valid_up_to: null;
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
      'Signatory-List': {
        description: 'Example response';
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Signatory';
              };
            };
          };
        };
      };
      'Employee-Onboarding-Status-Object': {
        description: 'Example response.';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Employee-Onboarding-Status';
            };
            examples: {
              Example: {
                value: {
                  uuid: 'string';
                  onboarding_status: 'string';
                  onboarding_steps: [
                    {
                      title: 'string';
                      id: 'string';
                      required: true;
                      completed: true;
                      requirements: ['string'];
                    },
                  ];
                };
              };
            };
          };
          'application/xml': {
            schema: {
              type: 'object';
              properties: {};
            };
          };
        };
      };
    };
    requestBodies: {
      'post-employee-ytd-benefit-amounts-from-different-company': {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                benefit_id: {
                  type: 'number';
                  description: 'The id for the benefit got from the benefits api.';
                };
                tax_year: {
                  type: 'number';
                  minimum: 2000;
                  maximum: 2999;
                  description: 'The tax year for which this amount applies.';
                };
                ytd_employee_deduction_amount: {
                  type: 'string';
                  default: '0.00';
                  description: 'The year-to-date employee deduction made outside the current company.';
                };
                ytd_company_contribution_amount: {
                  type: 'string';
                  default: '0.00';
                  description: 'The year-to-date company contribution made outside the current company.';
                };
              };
              required: ['benefit_id', 'tax_year', 'ytd_employee_deduction_amount', 'ytd_company_contribution_amount'];
            };
          };
        };
      };
    };
  };
  security: [
    {
      Authorization: [];
    },
  ];
};
