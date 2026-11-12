"""Render the real chess assets for the non-WebGL fallback. blender -b -P web/render_kings.py"""
import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'dist/staunton.glb'))
king=bpy.data.objects['K']
king.data=king.data.copy()
for o in list(bpy.context.scene.objects):
    if o!=king:bpy.data.objects.remove(o,do_unlink=True)
def mat(name,color,metal=0,rough=.26):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
ivory=mat('Warm porcelain',(.86,.81,.69),.08)
onyx=mat('Obsidian',(.025,.033,.043),.35,.22)
gold=mat('Antique gold',(.45,.27,.09),.78,.24)
king.name='WhiteKing';king.scale=(2.7,)*3;king.location=(-1.15,-.6,0);king.rotation_euler.z=-.28;king.data.materials.clear();king.data.materials.append(ivory)
black=king.copy();black.data=king.data.copy();bpy.context.collection.objects.link(black);black.name='BlackKing';black.location=(1.25,1.4,0);black.rotation_euler.z=.32;black.data.materials.clear();black.data.materials.append(onyx)
for k in [king,black]:
    for z,r in [(.31,.91),(.54,.76),(2.37,.53)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.018,major_segments=64,minor_segments=8,location=(k.location.x,k.location.y,z));bpy.context.object.data.materials.append(gold)
def light(name,loc,power,color,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
light('Warm key',(-5,-5,8),1200,(1,.86,.66),5)
light('Cold edge',(4,4,7),1800,(.5,.68,1),4)
light('Softbox',(2,-4,6),650,(1,.95,.85),3)
bpy.ops.object.camera_add(location=(8,-13,8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,.4,2.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=9.3;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=1400;s.render.resolution_y=1400;s.render.resolution_percentage=100;s.render.film_transparent=True
s.world=bpy.data.worlds.new('Studio world');s.world.color=(.16,.16,.16);s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(root/'dist/kings-render.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'web/kings.blend'))
bpy.ops.render.render(write_still=True)
