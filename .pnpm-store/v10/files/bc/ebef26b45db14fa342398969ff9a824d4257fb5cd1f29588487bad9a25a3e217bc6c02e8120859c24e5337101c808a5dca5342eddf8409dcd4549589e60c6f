import { AutoPaginatable } from '../../common/utils/pagination';
import { FGAList } from '../interfaces/list.interface';
import { Warning } from '../interfaces/warning.interface';
import { PaginationOptions } from '../../common/interfaces';
export declare class FgaPaginatable<T> extends AutoPaginatable<T> {
    protected list: FGAList<T>;
    constructor(list: FGAList<T>, apiCall: (params: PaginationOptions) => Promise<FGAList<T>>, options?: PaginationOptions);
    get warnings(): Warning[] | undefined;
}
