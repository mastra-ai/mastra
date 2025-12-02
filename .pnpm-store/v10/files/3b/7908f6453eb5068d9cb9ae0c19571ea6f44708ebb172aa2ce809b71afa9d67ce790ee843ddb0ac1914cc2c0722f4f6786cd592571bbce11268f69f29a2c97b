export declare const AZURE_APP_SERVICE_STAMP_RESOURCE_ATTRIBUTE = "azure.app.service.stamp";
export declare const CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE = "cloud.resource_id";
export declare const REGION_NAME = "REGION_NAME";
export declare const WEBSITE_HOME_STAMPNAME = "WEBSITE_HOME_STAMPNAME";
export declare const WEBSITE_HOSTNAME = "WEBSITE_HOSTNAME";
export declare const WEBSITE_INSTANCE_ID = "WEBSITE_INSTANCE_ID";
export declare const WEBSITE_OWNER_NAME = "WEBSITE_OWNER_NAME";
export declare const WEBSITE_RESOURCE_GROUP = "WEBSITE_RESOURCE_GROUP";
export declare const WEBSITE_SITE_NAME = "WEBSITE_SITE_NAME";
export declare const WEBSITE_SLOT_NAME = "WEBSITE_SLOT_NAME";
export declare const WEBSITE_SKU = "WEBSITE_SKU";
export declare const FUNCTIONS_VERSION = "FUNCTIONS_EXTENSION_VERSION";
export declare const FUNCTIONS_MEM_LIMIT = "WEBSITE_MEMORY_LIMIT_MB";
export declare const AZURE_VM_METADATA_HOST = "169.254.169.254";
export declare const AZURE_VM_METADATA_PATH = "/metadata/instance/compute?api-version=2021-12-13&format=json";
export declare const AZURE_VM_SCALE_SET_NAME_ATTRIBUTE = "azure.vm.scaleset.name";
export declare const AZURE_VM_SKU_ATTRIBUTE = "azure.vm.sku";
export interface AzureVmMetadata {
    azEnvironment?: string;
    additionalCapabilities?: {
        hibernationEnabled?: string;
    };
    hostGroup?: {
        id?: string;
    };
    host?: {
        id?: string;
    };
    extendedLocation?: {
        type?: string;
        name?: string;
    };
    evictionPolicy?: string;
    isHostCompatibilityLayerVm?: string;
    licenseType?: string;
    location: string;
    name: string;
    offer?: string;
    osProfile?: {
        adminUsername?: string;
        computerName?: string;
        disablePasswordAuthentication?: string;
    };
    osType?: string;
    placementGroupId?: string;
    plan?: {
        name?: string;
        product?: string;
        publisher?: string;
    };
    platformFaultDomain?: string;
    platformSubFaultDomain?: string;
    platformUpdateDomain?: string;
    priority?: string;
    provider?: string;
    publicKeys?: [
        {
            keyData?: string;
            path?: string;
        },
        {
            keyData?: string;
            path?: string;
        }
    ];
    publisher?: string;
    resourceGroupName?: string;
    resourceId: string;
    securityProfile?: {
        secureBootEnabled?: string;
        virtualTpmEnabled?: string;
        encryptionAtHost?: string;
        securityType?: string;
    };
    sku: string;
    storageProfile?: {
        dataDisks?: [
            {
                bytesPerSecondThrottle?: string;
                caching?: string;
                createOption?: string;
                diskCapacityBytes?: string;
                diskSizeGB?: string;
                image?: {
                    uri?: string;
                };
                isSharedDisk?: string;
                isUltraDisk?: string;
                lun?: string;
                managedDisk?: {
                    id?: string;
                    storageAccountType?: string;
                };
                name: string;
                opsPerSecondThrottle?: string;
                vhd?: {
                    uri?: string;
                };
                writeAcceleratorEnabled?: string;
            }
        ];
        imageReference?: {
            id?: string;
            offer?: string;
            publisher?: string;
            sku?: string;
            version?: string;
        };
        osDisk?: {
            caching?: string;
            createOption?: string;
            diskSizeGB?: string;
            diffDiskSettings?: {
                option?: string;
            };
            encryptionSettings?: {
                enabled?: string;
                diskEncryptionKey?: {
                    sourceVault?: {
                        id?: string;
                    };
                    secretUrl?: string;
                };
                keyEncryptionKey?: {
                    sourceVault?: {
                        id?: string;
                    };
                    keyUrl?: string;
                };
            };
            image?: {
                uri?: string;
            };
            managedDisk?: {
                id?: string;
                storageAccountType?: string;
            };
            name?: string;
            osType?: string;
            vhd?: {
                uri?: string;
            };
            writeAcceleratorEnabled?: string;
        };
        resourceDisk?: {
            size?: string;
        };
    };
    subscriptionId?: string;
    tags?: string;
    tagsList?: object[];
    customData?: string;
    userData?: string;
    version: string;
    virtualMachineScaleSet?: {
        id?: string;
    };
    vmId: string;
    vmScaleSetName: string;
    vmSize: string;
    zone?: string;
}
//# sourceMappingURL=types.d.ts.map