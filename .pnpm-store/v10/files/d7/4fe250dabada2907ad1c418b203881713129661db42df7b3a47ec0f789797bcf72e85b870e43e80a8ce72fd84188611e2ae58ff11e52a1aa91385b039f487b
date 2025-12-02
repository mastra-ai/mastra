
/* IMPORT */

import {LIMIT_FILES_DESCRIPTORS} from './constants';

/* MAIN */

class RetryfyQueue {

  /* VARIABLES */

  private interval: number = 25;
  private intervalId?: NodeJS.Timeout = undefined;
  private limit: number = LIMIT_FILES_DESCRIPTORS;
  private queueActive: Set<Function> = new Set ();
  private queueWaiting: Set<Function> = new Set ();

  /* LIFECYCLE API */

  init = (): void => {

    if ( this.intervalId ) return;

    this.intervalId = setInterval ( this.tick, this.interval );

  };

  reset = (): void => {

    if ( !this.intervalId ) return;

    clearInterval ( this.intervalId );

    delete this.intervalId;

  };

  /* API */

  add = ( fn: Function ): void => {

    this.queueWaiting.add ( fn );

    if ( this.queueActive.size < ( this.limit / 2 ) ) { // Active queue not under preassure, executing immediately

      this.tick ();

    } else {

      this.init ();

    }

  };

  remove = ( fn: Function ): void => {

    this.queueWaiting.delete ( fn );

    this.queueActive.delete ( fn );

  };

  schedule = (): Promise<Function> => {

    return new Promise ( resolve => {

      const cleanup = () => this.remove ( resolver );

      const resolver = () => resolve ( cleanup );

      this.add ( resolver );

    });

  };

  tick = (): void => {

    if ( this.queueActive.size >= this.limit ) return;

    if ( !this.queueWaiting.size ) return this.reset ();

    for ( const fn of this.queueWaiting ) {

      if ( this.queueActive.size >= this.limit ) break;

      this.queueWaiting.delete ( fn );
      this.queueActive.add ( fn );

      fn ();

    }

  };

};

/* EXPORT */

export default new RetryfyQueue ();
