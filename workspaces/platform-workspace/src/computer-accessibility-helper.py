import fcntl
import json
import os
import re
import secrets
import sys
import warnings

warnings.simplefilter('ignore')
# Snapshots hold window text: keep every file this helper writes private.
os.umask(0o077)

BASE = '/tmp/.mastra-desktop'
SNAPSHOTS = BASE + '/snapshots'
KEEP = 32
RESOLVE_CAP = 2000
REF = re.compile(r'^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9]{1,6})$')
SNAPSHOT_ID = re.compile(r'^[0-9a-f]{16}$')


class Done(Exception):
    def __init__(self, payload):
        self.payload = payload


def fail(error, message, **extra):
    raise Done(dict(ok=False, error=error, message=message, **extra))


def refuse(ref, reason, message=None):
    raise Done(dict(ok=False, error='ref', ref=ref, reason=reason, message=message))


def load_atspi():
    try:
        import gi
        gi.require_version('Atspi', '2.0')
        from gi.repository import Atspi
    except Exception as e:
        fail('unavailable', 'AT-SPI bindings unavailable: %s' % e)
    return Atspi


def generation():
    try:
        with open(BASE + '/generation') as f:
            value = f.read().strip()
    except OSError:
        value = ''
    if not value:
        fail('unavailable', 'desktop generation missing; the desktop is not running')
    return value


def identity(acc):
    return acc.app.bus_name, acc.path


def role_name(acc):
    return acc.get_role_name() or ''


def name_of(acc):
    return acc.get_name() or ''


def actions_of(acc):
    iface = acc.get_action_iface()
    if iface is None:
        return []
    return [iface.get_action_name(i) for i in range(iface.get_n_actions())]


def states_of(Atspi, acc):
    states = acc.get_state_set().get_states()
    return [Atspi.StateType(s).value_nick for s in states]


def value_of(acc):
    text = acc.get_text_iface()
    if text is not None and acc.get_editable_text_iface() is not None:
        return text.get_text(0, text.get_character_count())
    value = acc.get_value_iface()
    if value is not None:
        return str(value.get_current_value())
    return None


def bounds_of(Atspi, acc):
    component = acc.get_component_iface()
    if component is None:
        return None
    r = component.get_extents(Atspi.CoordType.SCREEN)
    if r.width <= 0 or r.height <= 0:
        return None
    return dict(x=r.x, y=r.y, width=r.width, height=r.height)


def children(acc):
    try:
        count = acc.get_child_count()
    except Exception:
        return []
    out = []
    for i in range(count):
        try:
            child = acc.get_child_at_index(i)
        except Exception:
            continue
        if child is not None:
            out.append(child)
    return out


def write_atomic(path, data):
    tmp = '%s.tmp.%s' % (path, secrets.token_hex(4))
    with open(tmp, 'w') as f:
        f.write(data)
    os.rename(tmp, path)


def save_snapshot(gen, records):
    os.makedirs(SNAPSHOTS, mode=0o700, exist_ok=True)
    with open(BASE + '/snapshots.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            with open(BASE + '/snapshot-seq') as f:
                seq = int(f.read().strip() or '0') + 1
        except (OSError, ValueError):
            seq = 1
        write_atomic(BASE + '/snapshot-seq', str(seq))
        snapshot_id = secrets.token_hex(8)
        write_atomic(
            '%s/%s.json' % (SNAPSHOTS, snapshot_id),
            json.dumps(dict(seq=seq, generation=gen, nodes=records)),
        )
        kept = []
        for entry in os.listdir(SNAPSHOTS):
            if not entry.endswith('.json'):
                continue
            path = '%s/%s' % (SNAPSHOTS, entry)
            try:
                with open(path) as f:
                    kept.append((int(json.load(f)['seq']), path))
            except Exception:
                kept.append((0, path))
        kept.sort()
        for _, path in kept[:-KEEP]:
            try:
                os.remove(path)
            except OSError:
                pass
    return snapshot_id


def op_ping(Atspi, req):
    gen = generation()
    Atspi.get_desktop(0).get_child_count()
    return dict(ok=True, generation=gen)


def op_tree(Atspi, req):
    gen = generation()
    app = req.get('app')
    max_depth = int(req.get('maxDepth') or 25)
    max_nodes = int(req.get('maxNodes') or 400)
    desktop = Atspi.get_desktop(0)
    roots = children(desktop)
    if app:
        wanted = str(app).lower()
        roots = [a for a in roots if name_of(a).lower() == wanted]
    nodes = []
    records = []
    truncated = False
    stack = [(a, 0) for a in reversed(roots)]
    while stack:
        acc, depth = stack.pop()
        if len(nodes) >= max_nodes:
            truncated = True
            break
        try:
            bus, path = identity(acc)
            node = dict(
                role=role_name(acc),
                name=name_of(acc),
                states=states_of(Atspi, acc),
                actions=actions_of(acc),
                depth=depth,
            )
            value = value_of(acc)
            if value is not None:
                node['value'] = value
            bounds = bounds_of(Atspi, acc)
            if bounds is not None:
                node['bounds'] = bounds
        except Exception:
            continue
        if 'defunct' in node['states']:
            continue
        records.append(dict(bus=bus, path=path, role=node['role'], name=node['name']))
        nodes.append(node)
        kids = children(acc)
        if depth + 1 >= max_depth:
            if kids:
                truncated = True
            continue
        stack.extend((c, depth + 1) for c in reversed(kids))
    snapshot_id = save_snapshot(gen, records)
    for n, node in enumerate(nodes):
        node['ref'] = '%s.%s.%d' % (gen, snapshot_id, n)
    return dict(ok=True, generation=gen, snapshotId=snapshot_id, truncated=truncated, nodes=nodes)


def valid_record(record):
    return isinstance(record, dict) and all(isinstance(record.get(k), str) for k in ('bus', 'path', 'role', 'name'))


def resolve(Atspi, ref):
    match = REF.match(ref) if isinstance(ref, str) else None
    if not match:
        refuse(str(ref), 'malformed', 'Accessibility ref %s is malformed; read the tree again' % ref)
    gen, snapshot_id, n = match.group(1), match.group(2), int(match.group(3))
    if gen != generation():
        refuse(ref, 'generation', 'Accessibility ref %s is from an earlier desktop session; read the tree again' % ref)
    try:
        if not SNAPSHOT_ID.match(snapshot_id):
            raise ValueError('bad snapshot id')
        with open('%s/%s.json' % (SNAPSHOTS, snapshot_id)) as f:
            snapshot = json.load(f)
        records = snapshot['nodes']
        if not isinstance(records, list):
            raise ValueError('bad nodes')
        stored = snapshot.get('generation')
    except Exception:
        refuse(ref, 'snapshot-missing', 'Accessibility ref %s belongs to a snapshot that no longer exists; read the tree again' % ref)
    # The ref's own generation is caller text: only the snapshot's stored one proves the session.
    if stored != gen:
        refuse(ref, 'generation', 'Accessibility ref %s is from an earlier desktop session; read the tree again' % ref)
    record = records[n] if n < len(records) else None
    if not valid_record(record):
        refuse(ref, 'malformed', 'Accessibility ref %s names no node in its snapshot; read the tree again' % ref)
    app = None
    for candidate in children(Atspi.get_desktop(0)):
        try:
            if candidate.app.bus_name == record['bus']:
                app = candidate
                break
        except Exception:
            continue
    found = None
    if app is not None:
        seen = 0
        stack = [app]
        while stack:
            acc = stack.pop()
            seen += 1
            if seen > RESOLVE_CAP:
                refuse(ref, 'gone', 'Accessibility ref %s was not found within 2,000 nodes; read the tree again' % ref)
            try:
                if acc.path == record['path']:
                    found = acc
                    break
            except Exception:
                continue
            stack.extend(reversed(children(acc)))
    if found is None:
        refuse(ref, 'gone', 'Accessibility ref %s no longer exists; read the tree again' % ref)
    try:
        if role_name(found) != record['role'] or name_of(found) != record['name']:
            refuse(ref, 'changed', 'Accessibility ref %s now has a different role or name; read the tree again' % ref)
    except Done:
        raise
    except Exception:
        refuse(ref, 'gone', 'Accessibility ref %s no longer exists; read the tree again' % ref)
    return found


def op_act(Atspi, req):
    acc = resolve(Atspi, req.get('ref'))
    action = req.get('action')
    names = actions_of(acc)
    if action not in names:
        fail('unknown-action', 'node supports actions: %s' % (', '.join(names) or 'none'), actions=names)
    if not acc.get_action_iface().do_action(names.index(action)):
        fail('action-failed', 'the application refused action %s' % action)
    return dict(ok=True)


def op_set_text(Atspi, req):
    acc = resolve(Atspi, req.get('ref'))
    editable = acc.get_editable_text_iface()
    if editable is None:
        names = actions_of(acc)
        fail('no-edit-text', 'node has no editable text; it supports actions: %s' % (', '.join(names) or 'none'), actions=names)
    text = req.get('text')
    if not isinstance(text, str):
        fail('bad-request', 'text must be a string')
    if not editable.set_text_contents(text):
        fail('action-failed', 'the application refused the text')
    return dict(ok=True)


OPS = dict(ping=op_ping, tree=op_tree, act=op_act, setText=op_set_text)


def main():
    try:
        try:
            req = json.loads(sys.argv[1])
            op = OPS[req['op']]
        except Exception:
            fail('bad-request', 'expected one JSON request argument with a known op')
        payload = op(load_atspi(), req)
    except Done as done:
        payload = done.payload
    except Exception as e:
        payload = dict(ok=False, error='internal', message='%s: %s' % (type(e).__name__, e))
    sys.stdout.write(json.dumps(payload) + '\n')


main()
