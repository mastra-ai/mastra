import { NextApiHandler, GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest, NextApiResponse } from 'next';
import { IronSessionOptions } from 'iron-session';
import { IncomingMessage, ServerResponse } from 'http';

declare type GetIronSessionApiOptions = (request: NextApiRequest, response: NextApiResponse) => Promise<IronSessionOptions> | IronSessionOptions;
declare function withIronSessionApiRoute(handler: NextApiHandler, options: IronSessionOptions | GetIronSessionApiOptions): NextApiHandler;
declare type GetIronSessionSSROptions = (request: IncomingMessage, response: ServerResponse) => Promise<IronSessionOptions> | IronSessionOptions;
declare function withIronSessionSsr<P extends {
    [key: string]: unknown;
} = {
    [key: string]: unknown;
}>(handler: (context: GetServerSidePropsContext) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>, options: IronSessionOptions | GetIronSessionSSROptions): (context: GetServerSidePropsContext) => Promise<GetServerSidePropsResult<P>>;

export { withIronSessionApiRoute, withIronSessionSsr };
