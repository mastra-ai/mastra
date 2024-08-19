import path from 'path';

import { NextResponse } from 'next/server';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

export async function GET() {
  try {
    const blueprintWriter = new BlueprintWriterService(path.join(__dirname, '../../../../mock-data/blueprints'));
    const blueprints = blueprintWriter.getBlueprints();
    return NextResponse.json(blueprints, {
      status: 200,
    });
  } catch (e) {
    return NextResponse.json(
      {
        message: 'Could not fetch blueprints',
        error: e,
      },
      {
        status: 400,
      },
    );
  }
}

// export async function POST(req: NextRequest) {
//   const db = createSupabaseServerClient();
//   const session = await db.auth.getSession();
//   const authUserId = session.data.session?.user.id;
//   const publicId = `kn_${createId()}`;

//   if (!authUserId) {
//     return NextResponse.json(
//       { message: 'Not authorized' },
//       {
//         status: 401,
//       },
//     );
//   }

//   const body = postNoteSchema.safeParse(await req.json());

//   if (!body.success) {
//     return NextResponse.json(
//       { message: 'Validation error', errors: body.error },
//       {
//         status: 400,
//       },
//     );
//   }

//   const { title, workspaceId } = body.data;

//   try {
//     const note = await noteService.createNote({
//       title,
//       publicId,
//       authUserId,
//       workspaceId,
//     });

//     return NextResponse.json(note, {
//       status: 200,
//     });
//   } catch (e) {
//     return NextResponse.json(
//       { message: 'Could not create found', error: e },
//       {
//         status: 500,
//       },
//     );
//   }
// }
