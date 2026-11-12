"""Blender (Cycles) render of the two kings leaning in for the duel, from the HD piece set.

Optional: the website draws this scene live with WebGL; this still image is only the fallback for
browsers without WebGL (dist/kings-render.png).

    blender -b -P web/hd/render_duel_blender.py

Tested only in the browser pipeline, not in Blender, because Blender was not available where this
was written. Adjust samples / resolution below if a render takes too long.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SAMPLES, SIZE = 96, (1600, 1000)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'dist/pieces-hd.glb'))
king = bpy.data.objects['K']
for o in list(bpy.context.scene.objects):
    if o is not king:
        bpy.data.objects.remove(o, do_unlink=True)


def material(name, color, metal=0.0, rough=0.3, coat=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    for key in ('Coat Weight', 'Clearcoat'):  # Blender 4.x / 3.x
        if key in p.inputs:
            p.inputs[key].default_value = coat
            break
    return m


ivory = material('Ivory marble', (0.86, 0.80, 0.68), rough=0.32, coat=0.7)
obsidian = material('Obsidian', (0.02, 0.022, 0.03), metal=0.12, rough=0.2, coat=1.0)
gold = material('Gold', (0.6, 0.38, 0.12), metal=1.0, rough=0.25, coat=0.0)

# Same stance as dist/js/versus.js: turned toward each other and leaning in (Blender is Z-up).
SCALE, X, YAW, LEAN = 1.72, 1.22, 0.66, 0.2
white = king
white.data = king.data.copy()
black = white.copy()
black.data = white.data.copy()
bpy.context.collection.objects.link(black)
for obj, side, mat in ((white, -1, ivory), (black, 1, obsidian)):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.scale = (SCALE,) * 3
    obj.location = (side * X, 0, 0)
    obj.rotation_mode = 'XYZ'
    # glTF import converts Y-up to Z-up, so yaw is about Z and the lean tilts about Y
    obj.rotation_euler = (math.pi / 2 if abs(obj.rotation_euler.x) > 1 else 0, side * LEAN, -side * YAW)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()

# the medallion between them
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.59, depth=0.1, location=(0, -1.68, 1.45), rotation=(math.pi / 2, 0, 0))
bpy.context.object.data.materials.append(gold)
bpy.ops.object.text_add(location=(0, -1.74, 1.3), rotation=(math.pi / 2, 0, 0))
txt = bpy.context.object
txt.data.body = 'VS'
txt.data.align_x = 'CENTER'
txt.data.size = 0.55
txt.data.extrude = 0.02
txt.data.materials.append(obsidian)

# floor that only catches shadows
bpy.ops.mesh.primitive_plane_add(size=40)
bpy.context.object.is_shadow_catcher = True


def area(name, loc, power, color, size):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy, d.color, d.shape, d.size = power, color, 'DISK', size
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 1.5)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


area('Warm key', (-6, -6, 7), 1400, (1, 0.83, 0.6), 4)
area('Cold key', (6, -5, 6), 1100, (0.6, 0.78, 1), 4)
area('Warm rim', (-4, 6, 5), 900, (1, 0.7, 0.36), 3)
area('Cold rim', (4, 6, 5), 1000, (0.42, 0.7, 1), 3)

bpy.ops.object.camera_add(location=(0, -9.8, 1.6))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 1.15)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 50
scene = bpy.context.scene
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = SIZE
scene.view_settings.view_transform = 'AgX' if 'AgX' in [v.name for v in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
scene.render.filepath = str(ROOT / 'dist/kings-render.png')
bpy.ops.render.render(write_still=True)
print('wrote', scene.render.filepath)
