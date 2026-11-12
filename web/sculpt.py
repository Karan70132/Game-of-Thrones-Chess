"""Build the six reusable Staunton meshes: blender -b -P web/sculpt.py"""
from pathlib import Path
from math import pi, sin, cos, radians
import bpy
from mathutils import Vector
out=Path(__file__).resolve().parents[1]/'dist'
bpy.ops.wm.read_factory_settings(use_empty=True)
def lathe(profile,steps=64):
    verts=[(r*cos(2*pi*j/steps),r*sin(2*pi*j/steps),z) for r,z in profile for j in range(steps)]
    faces=[(k*steps+j,k*steps+(j+1)%steps,(k+1)*steps+(j+1)%steps,(k+1)*steps+j) for k in range(len(profile)-1) for j in range(steps)]
    faces += [tuple(reversed(range(steps))),tuple(range(len(verts)-steps,len(verts)))]
    mesh=bpy.data.meshes.new("Turned profile");mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new("Turning",mesh);bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:face.use_smooth=True
    return obj
def sphere(pos,scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=pos)
    obj=bpy.context.object;obj.scale=scale
    for face in obj.data.polygons:face.use_smooth=True
    return obj
def block(pos,size,angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object;obj.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.rotation_euler.y=angle
    return obj
def focus(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
def cut(obj,tool):
    focus(obj);m=obj.modifiers.new("Carved recess","BOOLEAN");m.operation="DIFFERENCE";m.object=tool;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(tool,do_unlink=True)
def bevel(obj,w):
    focus(obj);m=obj.modifiers.new("Rounded edges","BEVEL");m.width=w;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
def horse():
    # Elliptical cross sections along the spine, tapering into a sloping muzzle.
    sections=[(-.09,.44,.23,.17),(-.12,.55,.234,.16),(-.145,.72,.214,.14),(-.14,.89,.175,.124),(-.09,1.015,.15,.115),(.01,1.072,.134,.11),(.116,1.043,.12,.096),(.202,.987,.096,.084),(.30,.919,.083,.076),(.333,.885,.068,.066),(.342,.873,.036,.04)]
    verts=[];n=32
    for k,(x,z,r,w) in enumerate(sections):
        a=sections[max(0,k-1)];b=sections[min(len(sections)-1,k+1)]
        dx,dz=b[0]-a[0],b[1]-a[1];length=(dx*dx+dz*dz)**.5
        for j in range(n):
            t=2*pi*j/n;verts.append((x+r*cos(t)*dz/length,w*sin(t),z-r*cos(t)*dx/length))
    faces=[(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(sections)-1) for j in range(n)]
    mesh=bpy.data.meshes.new('Horse');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Horse',mesh);bpy.context.collection.objects.link(o)
    for p in mesh.polygons:p.use_smooth=True
    for side in [-1,1]:
        ear=sphere((-.055,side*.066,1.174),(.045,.033,.104));ear.rotation_euler.y=-.22
        sphere((.10,side*.106,1.069),(.023,.011,.019))
        sphere((.311,side*.068,.914),(.018,.009,.012))
    for k in range(7):
        t=k/6; tuft=sphere((-.248+.15*t**2,0,.65+.47*t),(.072,.076,.118));tuft.rotation_euler.y=-.28
sizes={'P':(.26,.85),'N':(.335,1.17),'B':(.31,1.35),'R':(.32,1.07),'Q':(.345,1.53),'K':(.36,1.65)}
for kind,(r,h) in sizes.items():
    old=set(bpy.context.scene.objects)
    profile=[(.84,0),(.93,.011),(.975,.03),(1,.054),(.985,.078),(.91,.095),(.90,.111),(.94,.12),(.94,.136),(.87,.15),(.81,.157),(.82,.175),(.78,.19),(.66,.214),(.56,.245),(.49,.28),(.415,.34),(.365,.408),(.345,.46),(.37,.49),(.48,.505),(.57,.52),(.58,.543),(.52,.55),(.44,.562),(.46,.574),(.53,.586),(.53,.602),(.43,.615)]
    if kind=='N':profile=[(x,z*.67) for x,z in profile]
    main=lathe([(x*r,z*h) for x,z in profile])
    if kind=='P':sphere((0,0,h*.77),(r*.67,r*.67,h*.21))
    if kind=='R':
        head=lathe([(r*.52,h*.60),(r*.62,h*.66),(r*.78,h*.70),(r*.82,h*.76),(r*.82,h*.95)])
        for ang in [0,pi/3,2*pi/3]:
            tool=block((0,0,h*.94),(.085,.8,.16));tool.rotation_euler.z=ang;cut(head,tool)
        bevel(head,.009)
    if kind=='B':
        top=lathe([(r*.34,h*.61),(r*.56,h*.65),(r*.61,h*.71),(r*.55,h*.77),(r*.39,h*.835),(r*.22,h*.88),(r*.09,h*.92)])
        cut(top,block((.097,0,h*.837),(.032,.65,.37),-.48));bevel(top,.005)
        sphere((0,0,h*.946),(.054,.054,.061))
    if kind=='Q':
        lathe([(r*.39,h*.61),(r*.48,h*.67),(r*.61,h*.71),(r*.72,h*.77),(r*.72,h*.79),(r*.56,h*.79),(r*.37,h*.74)])
        for k in range(8):
            a=k*pi/4;sp=sphere((.208*cos(a),.208*sin(a),h*.80),(.042,.042,.082))
        sphere((0,0,h*.80),(.134,.134,.114));sphere((0,0,h*.887),(.052,.052,.069))
    if kind=='K':
        lathe([(r*.4,h*.61),(r*.56,h*.66),(r*.59,h*.71),(r*.5,h*.75),(r*.29,h*.774),(r*.25,h*.79)])
        bevel(block((0,0,h*.874),(.069,.073,h*.21)),.012)
        bevel(block((0,0,h*.90),(.216,.076,.064)),.012)
    if kind=='N':horse()
    focus(main)
    for o in set(bpy.context.scene.objects)-old:o.select_set(True)
    bpy.ops.object.join();main.name=kind
bpy.ops.export_scene.gltf(filepath=str(out/'staunton.glb'),export_format='GLB',export_materials='NONE',export_normals=True)
