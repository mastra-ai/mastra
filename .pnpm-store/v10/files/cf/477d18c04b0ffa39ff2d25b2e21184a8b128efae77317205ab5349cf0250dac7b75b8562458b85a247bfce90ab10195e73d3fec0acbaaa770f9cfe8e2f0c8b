import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { MySQLInstrumentationConfig } from './types';
import { MeterProvider } from '@opentelemetry/api';
export declare class MySQLInstrumentation extends InstrumentationBase<MySQLInstrumentationConfig> {
    static readonly COMMON_ATTRIBUTES: {
        "db.system": string;
    };
    private _connectionsUsage;
    constructor(config?: MySQLInstrumentationConfig);
    setMeterProvider(meterProvider: MeterProvider): void;
    private _setMetricInstruments;
    protected init(): InstrumentationNodeModuleDefinition[];
    private _patchCreateConnection;
    private _patchCreatePool;
    private _patchPoolEnd;
    private _patchCreatePoolCluster;
    private _patchAdd;
    private _patchGetConnection;
    private _getConnectionCallbackPatchFn;
    private _patchQuery;
    private _patchCallbackQuery;
    private _setPoolcallbacks;
}
//# sourceMappingURL=instrumentation.d.ts.map