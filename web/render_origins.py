"""Rebuild the nine original architecture sculptures: blender -b -P web/render_origins.py"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/origins'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'dist/staunton.glb'))
models = {k:bpy.data.objects[k].copy() for k in 'PNBRQK'}
for k, obj in models.items(): obj.data = obj.data.copy()
for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o, do_unlink=True)
def mat(name, rgb, metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=.29
    return m
ivory=mat('Limestone',(.78,.73,.61));dark=mat('Deep jade',(.032,.11,.12),.15)
gold=mat('Brushed brass',(.55,.32,.085),.72);blue=mat('Slate',(.16,.32,.38),.2)
def finish(o,material):
    o.data.materials.clear();o.data.materials.append(material)
    bevel=o.modifiers.new('Soft crafted edges','BEVEL');bevel.width=.035;bevel.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def cube(loc,scale,material=ivory):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,material)
def cyl(loc,r,depth,material=gold):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=loc)
    return finish(bpy.context.object,material)
def line(a,b,r=.035,material=gold):
    d=Vector(b)-Vector(a);o=cyl((Vector(a)+Vector(b))/2,r,d.length,material)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def ring(loc,r,material=gold):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.035,major_segments=64,minor_segments=8,location=loc)
    o=bpy.context.object;o.data.materials.append(material);return o
def man(k,loc,scale=.8,material=ivory):
    o=models[k].copy();o.data=models[k].data.copy();bpy.context.collection.objects.link(o)
    o.location=loc;o.scale=(scale,)*3;o.data.materials.clear();o.data.materials.append(material)
    return o
def plinth():
    cube((0,0,-.18),(4.4,4.4,.3),dark);cube((0,0,-.025),(4.2,4.2,.04),gold)
def sculpture(name):
    plinth()
    if name=='main.cpp':
        # A monumental doorway marks entry into the game loop.
        for i in range(4): cube((0,-1.3+i*.38,.1+i*.12),(2.8-i*.3,.4,.2+i*.24),ivory)
        for x in [-.9,.9]: cube((x,.6,1.05),(.42,.7,2.1),ivory)
        cube((0,.6,2.15),(2.3,.7,.35),gold)
        man('K',(0,.6,.08),1.2,dark)
        for x in [-1.65,1.65]: cyl((x,-.9,.4),.18,.8,gold)
    elif name=='game_board.cpp':
        for x in range(8):
            for y in range(8): cube(((x-3.5)*.48,(y-3.5)*.48,.1),(.47,.47,.2),ivory if (x+y)%2 else blue)
        man('K',(-1.2,1.2,.22),.85,dark);man('N',(.24,-.72,.22),.8,ivory)
        for x,y in [(1.2,-.24),(.72,.24)]: ring((x,y,.23),.16)
    elif name=='game_board.h':
        # Exploded layers of a board-state container.
        for z in [.25,.85,1.45]:
            for a,b in [((-1.5,-1.5,z),(1.5,-1.5,z)),((1.5,-1.5,z),(1.5,1.5,z)),((1.5,1.5,z),(-1.5,1.5,z)),((-1.5,1.5,z),(-1.5,-1.5,z))]: line(a,b)
            for n in range(1,4):
                line((-1.5+n*.75,-1.5,z),(-1.5+n*.75,1.5,z),.018,blue)
                line((-1.5,-1.5+n*.75,z),(1.5,-1.5+n*.75,z),.018,blue)
        for x,y in [(-1.5,-1.5),(1.5,1.5),(-1.5,1.5),(1.5,-1.5)]: line((x,y,.1),(x,y,1.6),.055)
        man('K',(0,0,1.5),.65,ivory)
    elif name=='chess_arsenal.cpp':
        # Six move implementations, six different pieces on museum columns.
        for i,k in enumerate('PNBRQK'):
            x=(i%3-1)*1.25;y=(i//3-.5)*1.5;h=.3+(i//3)*.35
            cyl((x,y,h/2),.48,h,blue);ring((x,y,h),.44)
            man(k,(x,y,h+.04),.72,ivory if i%2 else dark)
    elif name=='chess_arsenal.h':
        # The class hierarchy as a branching assembly.
        cyl((0,.75,.28),.65,.5,dark);man('K',(0,.75,.55),1.1,ivory)
        for i,k in enumerate('PNBRQ'):
            x=(i-2)*.75;y=-1.1
            line((0,.75,.4),(x,y,.4),.05)
            cyl((x,y,.25),.32,.45,blue);man(k,(x,y,.5),.52,ivory)
    elif name=='piece.h':
        # An open cage: one abstract contract shared by every concrete piece.
        for x,y in [(-.8,-.8),(.8,.8),(-.8,.8),(.8,-.8)]: line((x,y,.1),(x,y,2.2),.045)
        for z in [.12,2.2]:
            for a,b in [((-.8,-.8,z),(.8,-.8,z)),((.8,-.8,z),(.8,.8,z)),((.8,.8,z),(-.8,.8,z)),((-.8,.8,z),(-.8,-.8,z))]: line(a,b)
        cyl((0,0,.25),.7,.45,blue);man('P',(0,0,.5),1.6,ivory)
    elif name=='piece.cpp':
        # Identity and moved-status: three interlocking rings around a piece.
        cyl((0,0,.2),1.3,.35,blue);man('P',(0,0,.4),1.4,ivory)
        for r,z in [(1.05,.65),(1.25,.9),(1.45,1.15)]:
            o=ring((0,0,z),r);o.rotation_euler.x=.32
        for i in range(6):
            a=i*math.tau/6;cube((1.5*math.cos(a),1.5*math.sin(a),.18),(.28,.28,.3),gold)
    elif name=='helpers.cpp':
        # A compass shows orthogonal, diagonal and knight attack checks.
        cyl((0,0,.15),1.8,.26,blue);ring((0,0,.3),1.65)
        for i in range(8):
            a=i*math.pi/4;line((0,0,.35),(1.55*math.cos(a),1.55*math.sin(a),.35),.035)
        man('K',(0,0,.36),1.1,ivory)
        line((-.9,-1.2,.4),(-.9,-.2,.4),.07,ivory);line((-.9,-.2,.4),(-.4,-.2,.4),.07,ivory)
    else:
        # Two freestanding square brackets enclose the shared helper interface.
        for x in [-1.25,1.25]:
            cube((x,0,1.0),(.22,.55,2),gold)
            for z in [.12,1.88]: cube((x*.8,0,z),(.7,.55,.22),gold)
        for i in range(3): cube((0,0,.3+i*.42),(1.25,.7,.18),ivory if i%2 else blue)
        ring((0,0,.1),1.65)
def light(loc,power,color):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=5
    o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=20;s.cycles.use_denoising=False
s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.film_transparent=True
s.world=bpy.data.worlds.new('Gallery');s.world.color=(.18,.18,.18);s.view_settings.view_transform='AgX'
for src in sorted((ROOT/'original').glob('*')):
    for o in list(s.objects): bpy.data.objects.remove(o,do_unlink=True)
    sculpture(src.name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(src.name+'.glb')),export_format='GLB',use_selection=True,export_apply=True)
    light((-4,-6,8),1100,(1,.86,.65));light((5,3,6),1700,(.58,.78,1));light((1,-4,4),350,(1,1,1))
    bpy.ops.object.camera_add(location=(7,-10,8));cam=bpy.context.object
    cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.5;s.camera=cam
    s.render.image_settings.file_format='PNG';s.render.filepath=str(OUT/(src.name+'.png'));bpy.ops.render.render(write_still=True)
