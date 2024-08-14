'use server'

import { DataIntegrationCredential } from 'core'
import { future } from "../../../../example.future.config";

export async function connectIntegration({ name, credential, connectionId }: {
    name: string,
    connectionId: string
    credential: DataIntegrationCredential
}) {
    const authenticator = future.authenticator(name);

    await future.connectPlugin({ name, connectionId, authenticator, credential });
}

export async function buildRedirectUri({ name, connectionId, clientRedirectPath }: {
    name: string,
    connectionId: string
    clientRedirectPath: string
}) {
    const authenticator = future.authenticator(name);

    return await authenticator.getRedirectUri(clientRedirectPath);
}