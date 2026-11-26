"""Optional native GLES shader compile/link check, without a browser.
Run `node tools/check-shader-inputs.mjs` first, then
`MESA_SHADER_CACHE_DIR=/tmp/mesa-shanjiang python tools/check-shaders.py`.
Requires libEGL.so.1 and libGL.so.1 (Mesa works headlessly).
"""
import os,ctypes as C,json
os.environ['LIBGL_ALWAYS_SOFTWARE']='1'
e=C.CDLL('libEGL.so.1');g=C.CDLL('libGL.so.1')
def bind(lib,name,result,args):
 f=getattr(lib,name);f.restype=result;f.argtypes=args;return f
ptr=C.c_void_p;I=C.c_int;U=C.c_uint
getproc=bind(e,'eglGetProcAddress',ptr,[C.c_char_p])
platform=C.CFUNCTYPE(ptr,U,ptr,C.POINTER(I))(getproc(b'eglGetPlatformDisplayEXT'))
dpy=platform(0x31DD,None,None)
init=bind(e,'eglInitialize',U,[ptr,C.POINTER(I),C.POINTER(I)]);major=I();minor=I();assert init(dpy,C.byref(major),C.byref(minor))
assert bind(e,'eglBindAPI',U,[U])(0x30A2)
attrs=(I*9)(0x3033,1,0x3040,8,0x3024,8,0x3025,8,0x3038);config=ptr();n=I()
assert bind(e,'eglChooseConfig',U,[ptr,C.POINTER(I),C.POINTER(ptr),I,C.POINTER(I)])(dpy,attrs,C.byref(config),1,C.byref(n))
contextAttrs=(I*7)(0x3098,3,0x30FB,3,0x30FD,1,0x3038)
context=bind(e,'eglCreateContext',ptr,[ptr,ptr,ptr,C.POINTER(I)])(dpy,config,None,contextAttrs)
assert context and bind(e,'eglMakeCurrent',U,[ptr,ptr,ptr,ptr])(dpy,None,None,context)
print('Native shader compiler:',bind(g,'glGetString',C.c_char_p,[U])(0x1F02).decode())
create=bind(g,'glCreateShader',U,[U]);source=bind(g,'glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)]);compile=bind(g,'glCompileShader',None,[U]);get=bind(g,'glGetShaderiv',None,[U,U,C.POINTER(I)]);log=bind(g,'glGetShaderInfoLog',None,[U,I,C.POINTER(I),C.c_char_p])
createProgram=bind(g,'glCreateProgram',U,[]);attachShader=bind(g,'glAttachShader',None,[U,U]);linkProgram=bind(g,'glLinkProgram',None,[U]);getProgram=bind(g,'glGetProgramiv',None,[U,U,C.POINTER(I)]);programLog=bind(g,'glGetProgramInfoLog',None,[U,I,C.POINTER(I),C.c_char_p])
failed=False
for case in json.load(open('/tmp/shanjiang-shaders.json')):
 program=createProgram()
 for stage,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
  sh=create(kind);code=C.c_char_p(case[stage].encode());source(sh,1,C.byref(code),None);compile(sh);status=I();get(sh,0x8B81,C.byref(status))
  if not status.value:
   failed=True;buf=C.create_string_buffer(12000);log(sh,12000,None,buf);print(case['name'],stage,'FAIL',buf.value.decode())
  else:attachShader(program,sh)
 linkProgram(program);status=I();getProgram(program,0x8B82,C.byref(status))
 if not status.value:
  failed=True;buf=C.create_string_buffer(12000);programLog(program,12000,None,buf);print(case['name'],'LINK FAIL',buf.value.decode())
 else:print(case['name'],'compile + link PASS')
assert not failed
