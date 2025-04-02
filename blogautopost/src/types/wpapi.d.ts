declare module 'wpapi' {
  interface WPRequest {
    get(): Promise<any>;
    create(data: any): Promise<any>;
    update(data: any): Promise<any>;
    delete(): Promise<any>;
    id(id: number): WPRequest;
    perPage(perPage: number): WPRequest;
    page(page: number): WPRequest;
    search(search: string): WPRequest;
    slug(slug: string): WPRequest;
    status(status: string): WPRequest;
    category(category: number): WPRequest;
  }

  interface WPAPI {
    posts(): WPRequest;
    pages(): WPRequest;
    categories(): WPRequest;
    tags(): WPRequest;
    users(): WPRequest;
    media(): WPRequest;
    comments(): WPRequest;
    taxonomies(): WPRequest;
    types(): WPRequest;
    statuses(): WPRequest;
    settings(): WPRequest;
  }

  interface WPAPIOptions {
    endpoint: string;
    username?: string;
    password?: string;
    auth?: boolean;
    nonce?: string;
  }

  function WPAPI(options: WPAPIOptions): WPAPI;

  namespace WPAPI {
    function discover(url: string): Promise<WPAPI>;
  }

  export = WPAPI;
} 