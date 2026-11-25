"""Blender 4.3: convert licensed Rocketbox FBX/TGA sources to local animated GLB.
Usage: blender -b --python tools/prepare-characters.py -- /path/to/source-directories
Source files are downloaded separately; see models/sources.json.
"""
import bpy, math, sys, pathlib
from mathutils import Vector, Matrix, Quaternion
source=pathlib.Path(sys.argv[sys.argv.index('--')+1])
out=pathlib.Path(__file__).resolve().parents[1]/'models'
for name,slug in [('Female_Adult_03','lin'),('Male_Adult_16','traveler'),('Wood_Male_01','lo')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 folder=source/name
 bpy.ops.import_scene.fbx(filepath=str(folder/(name+'.fbx')))
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 for o in bpy.data.objects:o.animation_data_clear()
 # Author materials explicitly; imported FBX contains workstation-specific paths.
 for mat in bpy.data.materials:
  mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
  output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');links.new(shader.outputs['BSDF'],output.inputs['Surface'])
  shader.inputs['Roughness'].default_value=.72
  files=list(folder.glob(mat.name+'_color.tga'))
  if not files:continue
  image=bpy.data.images.load(str(files[0]));image.scale(1024,1024)
  tex=nodes.new('ShaderNodeTexImage');tex.image=image;links.new(tex.outputs['Color'],shader.inputs['Base Color'])
  normalfile=folder/(mat.name+'_normal.tga')
  if normalfile.exists():
   im=bpy.data.images.load(str(normalfile));im.scale(1024,1024);im.colorspace_settings.name='Non-Color'
   n=nodes.new('ShaderNodeTexImage');n.image=im;normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55;links.new(n.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
  if 'opacity' in mat.name:
   # Hair alpha comes from luminance in a separate atlas.
   links.new(tex.outputs['Color'],shader.inputs['Alpha']);mat.surface_render_method='DITHERED'
   head=next((i for i in bpy.data.images if '_head_color' in i.name),None)
   if head:
    color=nodes.new('ShaderNodeTexImage');color.image=head;links.new(color.outputs['Color'],shader.inputs['Base Color'])
 # Relax A-pose arms in world coordinates before authoring idle and walk clips.
 down=arm.matrix_world.inverted().to_3x3() @ Vector((0,0,-1))
 for side in ['L','R']:
  upper=arm.pose.bones['Bip01 '+side+' UpperArm'];fore=arm.pose.bones['Bip01 '+side+' Forearm']
  bpy.context.view_layer.update();direction=(fore.head-upper.head).normalized()
  desired=(down+arm.matrix_world.inverted().to_3x3()@Vector((.12 if side=='L' else -.12,0,0))).normalized()
  rotation=direction.rotation_difference(desired).to_matrix().to_4x4()
  upper.matrix=Matrix.Translation(upper.head)@rotation@Matrix.Translation(-upper.head)@upper.matrix
 bpy.context.view_layer.update()
 base={b.name:b.rotation_quaternion.copy() for b in arm.pose.bones}
 # Local rotation axis corresponding to world X, for natural forward leg swing.
 axes={b.name:(arm.matrix_world.to_3x3()@b.bone.matrix_local.to_3x3()).inverted()@Vector((1,0,0)) for b in arm.pose.bones}
 def reset():
  for b in arm.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
 scene=bpy.context.scene;scene.render.fps=24
 for actionname,walk in [('Idle',False),('Walk',True)]:
  arm.animation_data_create();action=bpy.data.actions.new(actionname);arm.animation_data.action=action
  for frame in range(1,26,2):
   scene.frame_set(frame);reset();phase=(frame-1)/24*math.tau
   for side,offset in [('L',0),('R',math.pi)]:
    stride=math.sin(phase+offset)
    for part,angle in [('Thigh',stride*.32),('Calf',max(0,-stride)*.4),('UpperArm',-stride*.2)]:
     b=arm.pose.bones['Bip01 '+side+' '+part]
     if walk:b.rotation_quaternion=base[b.name]@Quaternion(axes[b.name],angle)
   if not walk:
    for part,amount in [('Spine2',.009),('Head',.012)]:
     b=arm.pose.bones['Bip01 '+part];b.rotation_quaternion=base[b.name]@Quaternion(axes[b.name],math.sin(phase)*amount)
   for b in arm.pose.bones:b.keyframe_insert(data_path='rotation_quaternion',frame=frame)
  track=arm.animation_data.nla_tracks.new();track.name=actionname;track.strips.new(actionname,1,action);arm.animation_data.action=None
 scene.frame_set(1);reset();bpy.context.view_layer.update()
 bpy.ops.export_scene.gltf(filepath=str(out/(slug+'.glb')),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=84,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_extras=False)
 print('EXPORTED',slug,(out/(slug+'.glb')).stat().st_size)
 # Save a working scene for offline geometry/material review.
 if slug=='lin':bpy.ops.wm.save_as_mainfile(filepath='/tmp/shanjiang-cast-review.blend')
