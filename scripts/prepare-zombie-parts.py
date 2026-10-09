"""Offline glTF partition by authored skin influence. Keeps each triangle once.
No bone scaling or runtime topology surgery. Source models remain unchanged.
"""
import json, base64, struct, collections, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
REGIONS = {'Head':'head','UpperArm.L':'arm-l','UpperArm.R':'arm-r','UpperLeg.L':'leg-l','UpperLeg.R':'leg-r'}
def prepare(name):
    source = ROOT / 'public/assets/zombie-kit' / (name + '.gltf')
    g=json.loads(source.read_text()); buffers=[bytearray(base64.b64decode(b['uri'].split(',')[1])) for b in g['buffers']]
    def accessor(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];size=struct.calcsize(fmt)*count;start=v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*count,buffers[v['buffer']],start+k*v.get('byteStride',size)) for k in range(a['count'])]
    regions={}
    def assign(i,region):
        regions[i]=region
        for child in g['nodes'][i].get('children',[]):assign(child,region)
    for i,n in enumerate(g['nodes']):
        if n.get('name') in REGIONS:assign(i,REGIONS[n['name']])
    def indices(values):
        b=buffers[0]
        while len(b)%4:b.append(0)
        offset=len(b);b.extend(struct.pack('<'+'I'*len(values),*values));view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4,'target':34963})
        a=len(g['accessors']);g['accessors'].append({'bufferView':view,'componentType':5125,'count':len(values),'type':'SCALAR','min':[min(values)],'max':[max(values)]});return a
    def compact_attribute(original, vertices):
        a=g['accessors'][original];v=g['bufferViews'][a['bufferView']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        unit={5121:1,5123:2,5125:4,5126:4}[a['componentType']];size=unit*width
        data=buffers[v['buffer']];start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
        rows=[bytes(data[start+i*stride:start+i*stride+size]) for i in vertices]
        b=buffers[0]
        while len(b)%4:b.append(0)
        offset=len(b);b.extend(b''.join(rows));view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(rows)*size,'target':34962})
        result={k:value for k,value in a.items() if k not in ['bufferView','byteOffset','min','max','count']}
        result.update(bufferView=view,count=len(vertices));index=len(g['accessors']);g['accessors'].append(result);return index
    counts=collections.Counter()
    for node in list(g['nodes']):
        if 'mesh' not in node or 'skin' not in node:continue
        joint_nodes=g['skins'][node['skin']]['joints'];parts=collections.defaultdict(list)
        for prim in g['meshes'][node['mesh']]['primitives']:
            joints=accessor(prim['attributes']['JOINTS_0']);weights=accessor(prim['attributes']['WEIGHTS_0']); labels=[]
            for js,ws in zip(joints,weights):
                scores=collections.Counter()
                for j,w in zip(js,ws):scores[regions.get(joint_nodes[j],'torso')]+=w
                labels.append(scores.most_common(1)[0][0])
            original=[v[0] for v in accessor(prim['indices'])];buckets=collections.defaultdict(list)
            for k in range(0,len(original),3):
                tri=original[k:k+3];region=collections.Counter(labels[i] for i in tri).most_common(1)[0][0];buckets[region].extend(tri)
            for region,tri in buckets.items():
                vertices=list(dict.fromkeys(tri));mapping={old:new for new,old in enumerate(vertices)}
                copy=dict(prim);copy['attributes']={name:compact_attribute(attr,vertices) for name,attr in prim['attributes'].items()};copy['indices']=indices([mapping[i] for i in tri]);parts[region].append(copy);counts[region]+=len(tri)//3
        original_name=node.get('name','mesh');mesh=node.pop('mesh');skin=node.pop('skin')
        for region,primitives in parts.items():
            mi=len(g['meshes']);g['meshes'].append({'name':original_name+'-'+region,'primitives':primitives})
            ni=len(g['nodes']);g['nodes'].append({'name':'part-'+region+'-'+original_name,'mesh':mi,'skin':skin})
            node.setdefault('children',[]).append(ni)
    for b,data in zip(g['buffers'],buffers):b['byteLength']=len(data);b['uri']='data:application/octet-stream;base64,'+base64.b64encode(data).decode()
    dest=source.with_name(name+'-parts.gltf');dest.write_text(json.dumps(g,separators=(',',':')))
    print(dest.name,dict(counts),dest.stat().st_size)
if __name__=='__main__':
    for name in ['Zombie_Basic','Zombie_Chubby']:prepare(name)
