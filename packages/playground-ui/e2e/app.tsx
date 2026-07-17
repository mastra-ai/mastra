import { createRoot } from 'react-dom/client';

import { FieldBlock } from '../src/ds/components/FormFieldBlocks/block/field-block';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../src/ds/components/Select/select';
import './style.css';

const host = document.getElementById('root');
if (!host) throw new Error('Expected the test app root');

createRoot(host).render(
  <div className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden">
    <header className="h-24 shrink-0" />
    <main
      data-testid="page-scroller"
      className="isolate mx-2 mb-2 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
    >
      <div className="mx-auto w-full min-w-0 px-6 py-8" style={{ paddingTop: 900 }}>
        <main className="min-w-0">
          <FieldBlock.Layout>
            <FieldBlock.Column>
              <FieldBlock.Label name="environment-region">Production environment location</FieldBlock.Label>
              <Select name="environment-region" value="pdx">
                <SelectTrigger id="input-environment-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdx">US West</SelectItem>
                </SelectContent>
              </Select>
            </FieldBlock.Column>
          </FieldBlock.Layout>
        </main>
      </div>
    </main>
  </div>,
);
