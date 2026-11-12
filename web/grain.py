"""Create a reusable seamless-style grayscale wood grain map for the board."""
import numpy as np
from PIL import Image
from pathlib import Path
rng=np.random.default_rng(572)
w,h=768,256
def noise(x,y):
    raw=Image.fromarray(rng.integers(0,255,(y,x),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC)
    return np.asarray(raw)/255
y,x=np.mgrid[:h,:w]
bend=noise(4,4)*2.4+noise(8,6)*.55+np.sin(x/172+y/101)*.44
ring=(np.sin(y*.39+bend*4+noise(6,18))*.5+.5)**6
fibres=noise(14,190)*.14+noise(3,130)*.12
shade=np.clip(.73+fibres+.08*noise(3,11)-.105*ring+.013*rng.normal(size=(h,w)),0,1)
Image.fromarray((shade*255).astype(np.uint8)).save(Path(__file__).resolve().parents[1]/'dist/grain.jpg',quality=89)
