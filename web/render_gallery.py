"""Render actual model views for devices without WebGL."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'web/kings.blend'))
for o in list(bpy.context.scene.objects):
    if o.type=='MESH':bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(root/'dist/staunton.glb'))
models={k:bpy.data.objects[k] for k in 'PNBRQK'}
ivory=bpy.data.materials['Warm porcelain'];black=bpy.data.materials['Obsidian']
s=bpy.context.scene;s.cycles.samples=20;s.render.resolution_x=s.render.resolution_y=750
cam=s.camera;cam.location=(4,-7,4);cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.4
for k,o in models.items():
    o.data.materials.clear();o.data.materials.append(ivory);o.hide_render=True
for k,o in models.items():
    o.hide_render=False;s.render.filepath=str(root/f'dist/piece-{k}.png');bpy.ops.render.render(write_still=True);o.hide_render=True
def cube(loc,scale,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;o.data.materials.append(material)
cube((0,0,-.22),(8.65,8.65,.35),black)
for i in range(64):cube((i%8-3.5,i//8-3.5,-.025),(.995,.995,.05),ivory if (i%8+i//8)%2 else black)
for c in range(8):
    for row,k,b in [(0,'RNBQKBNR'[c],True),(1,'P',True),(6,'P',False),(7,'RNBQKBNR'[c],False)]:
        o=models[k].copy();o.data=models[k].data.copy();bpy.context.collection.objects.link(o);o.hide_render=False;o.location=(c-3.5,row-3.5,0);o.data.materials.clear();o.data.materials.append(black if b else ivory)
cam.location=(11,-15,13);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=13.2;s.render.resolution_x=s.render.resolution_y=1000;s.render.filepath=str(root/'dist/board-render.png');bpy.ops.render.render(write_still=True)
