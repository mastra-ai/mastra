import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineMastraCodePlugin, z } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: 'proof.settings',
  name: 'Settings proof',
  settingsCommands: context => {
    const schema = z.object({ enabled: z.boolean(), label: z.string().min(1), policy: z.enum(['skip', 'send']) });
    const file = (binding: { resourceId: string; threadId: string }) =>
      join(
        context.dataDir,
        createHash('sha256')
          .update(JSON.stringify([binding.resourceId, binding.threadId]))
          .digest('hex') + '.json',
      );
    return {
      'settings-proof': {
        label: 'Native settings proof',
        fields: {
          enabled: { type: 'boolean', label: 'Enabled' },
          label: { type: 'string', label: 'Label' },
          policy: {
            type: 'select',
            label: 'Policy',
            options: [
              { label: 'Skip', value: 'skip' },
              { label: 'Send', value: 'send' },
            ],
          },
        },
        schema,
        resolve: binding => ({
          values: existsSync(file(binding))
            ? schema.parse(JSON.parse(readFileSync(file(binding), 'utf8')))
            : { enabled: false, label: 'initial', policy: 'skip' },
          status: [{ label: 'Storage', value: file(binding) }],
        }),
        save: async (values, binding) => {
          binding.signal.throwIfAborted();
          mkdirSync(context.dataDir, { recursive: true });
          writeFileSync(file(binding), JSON.stringify(values));
        },
      },
    };
  },
});
