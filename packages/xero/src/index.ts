import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import XeroLogo from './assets/xero.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type XeroConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class XeroIntegration extends Integration {
  availableScopes = [
    {
      key: `accounting.attachments`,
      description: `Grant read-write access to attachments`,
    },
    {
      key: `accounting.attachments.read`,
      description: `Grant read-only access to attachments`,
    },
    {
      key: `accounting.contacts`,
      description: `Grant read-write access to contacts and contact groups`,
    },
    {
      key: `accounting.contacts.read`,
      description: `Grant read-only access to contacts and contact groups`,
    },
    {
      key: `accounting.journals.read`,
      description: `Grant read-only access to journals`,
    },
    {
      key: `accounting.reports.read`,
      description: `Grant read-only access to accounting reports`,
    },
    {
      key: `accounting.reports.tenninetynine.read`,
      description: `Grant read-only access to 1099 reports`,
    },
    {
      key: `accounting.settings`,
      description: `Grant read-write access to organisation and account settings`,
    },
    {
      key: `accounting.settings.read`,
      description: `Grant read-only access to organisation and account settings`,
    },
    {
      key: `accounting.transactions`,
      description: `Grant read-write access to bank transactions, credit notes, invoices, repeating invoices`,
    },
    {
      key: `accounting.transactions.read`,
      description: `Grant read-only access to invoices`,
    },
    {
      key: `assets`,
      description: `Grant read-write access to assets`,
    },
    {
      key: `assets.read`,
      description: `Grant read-only access to fixed assets`,
    },
    {
      key: `bankfeeds`,
      description: `Grant read-write access to bankfeeds`,
    },
    {
      key: `email`,
      description: `Grant read-only access to your email`,
    },
    {
      key: `files`,
      description: `Grant read-write access to files and folders`,
    },
    {
      key: `files.read`,
      description: `Grant read-only access to files and folders`,
    },
    {
      key: `openid`,
      description: `Grant read-only access to your open id`,
    },
    {
      key: `paymentservices`,
      description: `Grant read-write access to payment services`,
    },
    {
      key: `payroll`,
      description: `Grant read-write access to payroll`,
    },
    {
      key: `payroll.employees`,
      description: `Grant read-write access to payroll employees`,
    },
    {
      key: `payroll.employees.read`,
      description: `Grant read-only access to payroll employees`,
    },
    {
      key: `payroll.leaveapplications`,
      description: `Grant read-write access to payroll leaveapplications`,
    },
    {
      key: `payroll.leaveapplications.read`,
      description: `Grant read-only access to payroll leaveapplications`,
    },
    {
      key: `payroll.payitems`,
      description: `Grant read-write access to payroll payitems`,
    },
    {
      key: `payroll.payitems.read`,
      description: `Grant read-only access to payroll payitems`,
    },
    {
      key: `payroll.payrollcalendars`,
      description: `Grant read-write access to payroll calendars`,
    },
    {
      key: `payroll.payrollcalendars.read`,
      description: `Grant read-only access to payroll calendars`,
    },
    {
      key: `payroll.payruns`,
      description: `Grant read-write access to payroll payruns`,
    },
    {
      key: `payroll.payruns.read`,
      description: `Grant read-only access to payroll payruns`,
    },
    {
      key: `payroll.payslip`,
      description: `Grant read-write access to payroll payslips`,
    },
    {
      key: `payroll.payslip.read`,
      description: `Grant read-only access to payroll payslips`,
    },
    {
      key: `payroll.read`,
      description: `Grant read-only access to payroll`,
    },
    {
      key: `payroll.settings.read`,
      description: `Grant read-only access to payroll settings`,
    },
    {
      key: `payroll.superfundproducts.read`,
      description: `Grant read-only access to payroll superfundproducts`,
    },
    {
      key: `payroll.superfunds`,
      description: `Grant read-write access to payroll superfunds`,
    },
    {
      key: `payroll.superfunds.read`,
      description: `Grant read-only access to payroll superfunds`,
    },
    {
      key: `payroll.timesheets`,
      description: `Grant read-write access to payroll timesheets`,
    },
    {
      key: `payroll.timesheets.read`,
      description: `Grant read-only access to payroll timesheets`,
    },
    {
      key: `profile`,
      description: `your profile information`,
    },
    {
      key: `projects`,
      description: `Grant read-write access to projects`,
    },
    {
      key: `projects.read`,
      description: `Grant read-only access to projects`,
    },
  ];

  constructor({ config }: { config: XeroConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'XERO',
      logoUrl: XeroLogo,
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://api.xero.com/api.xro/2.0`,
      globalParams: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    return client as any;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://api.xero.com/api.xro/2.0`,
        AUTHORIZATION_ENDPOINT: `https://login.xero.com/identity/connect/authorize`,
        TOKEN_ENDPOINT: `https://identity.xero.com/connect/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
