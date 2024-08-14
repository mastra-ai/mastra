'use-client'

import { Button } from "@/components/ui/button"
import { buildRedirectUri, connectIntegration } from "./actions"
import { useCallback, useState } from "react";

export function IntegrationRow({ integration }: { integration: any }) {
    const name = integration.name
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnectingManually, setIsConnectingManually] = useState(false);

    const handleConnect = useCallback(async () => {
        setIsConnecting(true);
        try {
            window.location.assign(await buildRedirectUri({ name, connectionId: '1', clientRedirectPath: 'import-data' }));
        } catch (err) {
            console.error(err);
        } finally {
            setIsConnecting(false);
        }
    }, [isConnectingManually, name]);


    return (
        <div className="flex">
            <div className="flex-1 self-center">
                <p key={integration.name}>{integration.name}</p>
            </div>
            <Button
                className="h-[31px] text-xs"
                size="sm"
                onClick={handleConnect}
            >
                Connect
            </Button>
        </div>
    )
}