import sys
from PIL import Image, ImageDraw
n=sys.argv[1]; ps=sys.argv[2].split(',') if len(sys.argv)>2 else ['0','10','22','34','46','58','70','85']
ims=[Image.open(f'/tmp/a-{n}-{st}-{p}.png').convert('RGB') for st in 'ef' for p in ps]
bb=None
for im in ims:
  g=im.point(lambda v:255 if v>30 else 0).convert('L').getbbox()
  if g: bb=g if bb is None else (min(bb[0],g[0]),min(bb[1],g[1]),max(bb[2],g[2]),max(bb[3],g[3]))
pad=12; bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),bb[2]+pad,bb[3]+pad)
ims=[i.crop(bb) for i in ims]; w,h=ims[0].size
s=min(1.0,230/w); w2,h2=int(w*s),int(h*s)
c=Image.new('RGB',(w2*4+30,h2*4+40),(70,70,70))
for k,im in enumerate(ims):
  r,col=k//4,k%4; y=r*(h2+10)+(10 if r>=2 else 0)
  c.paste(im.resize((w2,h2)),(col*(w2+10),y))
c.save(f'/tmp/G-{n}.png')
