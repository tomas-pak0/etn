import subprocess,time,re,xml.etree.ElementTree as ET
from pathlib import Path
Path('evidence').mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args])
def dump():
 adb('shell','uiautomator','dump','/sdcard/ui.xml')
 data=adb('shell','cat','/sdcard/ui.xml');Path('evidence/last-ui.xml').write_bytes(data);return ET.fromstring(data)
def shot(name):Path('evidence/'+name+'.png').write_bytes(adb('exec-out','screencap','-p'))
def tap(pattern):
 for node in dump().iter('node'):
  if any(re.search(pattern,node.get(k,''),re.I) for k in ['text','content-desc']):
   b=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
   if len(b)==4 and b[2]>b[0] and b[3]>b[1] and b[3]>102 and b[1]<1812:
    adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(1);return True
 return False
def waittap(pattern):
 for _ in range(8):
  if tap(pattern):return True
  time.sleep(1)
 return False
def text():return ' '.join(n.get('text','')+' '+n.get('content-desc','') for n in dump().iter('node'))
def dismiss_discoveries():
 # A first fix can discover the country, settlement and administrative center.
 # Each queued dialog must close before tapping controls underneath it.
 for _ in range(12):
  if not tap(r'^Continue exploring$|^Tęsti tyrinėjimą$'):return
  time.sleep(.4)
 raise AssertionError('Discovery queue did not close')
def waittext(pattern):
 for _ in range(8):
  if re.search(pattern,text(),re.I):return True
  time.sleep(1)
 return False
time.sleep(3);shot('01-map-shell')
assert waittap(r'^Start exploring.*|^Pradėti tyrinėjimą.*'),'Start missing'
assert waittap(r'^OK\s*$'),'Location disclosure missing'
assert waittap(r'While using the app|While using this app|Naudojant programėlę'),'Location permission missing'
waittap(r'^Allow\s*$|^Leisti\s*$')
adb('emu','geo','fix','25.2797','54.6872');time.sleep(5)
dismiss_discoveries();time.sleep(2)
shot('02-exploring')
assert tap(r'^Hide map$|^Be žemėlapio$'),'Blank map button missing'
assert waittext(r'Show map|Rodyti žemėlapį'),'Blank map switch did not activate'
shot('03-blank-map')
assert tap(r'^Explored$|^Ištirta$'),'Explored tab missing';time.sleep(2);shot('04-explored')
assert waittext(r'Lietuva|Lithuania'),'GPS country not set'
assert tap(r'^Explorers$|^Tyrinėtojai$'),'Explorers tab missing';time.sleep(3);shot('05-explorers')
assert re.search(r'Register / sign in|Registruotis / prisijungti',text()),'Optional registration missing'
assert tap(r'^Information$|^Informacija$'),'Info tab missing';shot('06-information')
for _ in range(8):
 if tap(r'^Found a bug\?$|^Radote klaidą\?$'):break
 adb('shell','input','swipe','500','1400','500','500','350');time.sleep(.5)
else:raise AssertionError('Report bug missing')
assert 'ETN DEBUG EMAIL RECEIVER' in text(),'Native mail draft receiver missing'
assert 'ETN v0.7.1' in text(),'New release version missing from email draft'
shot('07-email-draft');adb('shell','input','keyevent','4');time.sleep(1)
assert tap(r'^Map$|^Žemėlapis$'),'Fixed navigation lost after scrolling'
assert tap(r'^Stop$|^Stabdyti$'),'Stop missing'
Path('evidence/shell-validation.txt').write_text('Android 15 emulator: fixed navigation, four panels, GPS Lithuania, blank map, optional registration, native bug-report draft and Stop verified. No message sent.\n')
print('Android shell smoke passed')
