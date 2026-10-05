import AppKit
import Foundation
// Bake platform-native color emojis once. PNGs are reused by all later renders,
// so rendering never depends on browser emoji fallback or a remote service.
let jobs = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) as! [[String:String]]
for job in jobs {
 let target = job["path"]!
 if FileManager.default.fileExists(atPath: target) { continue }
 let size=NSSize(width:160,height:160)
 let image=NSImage(size:size)
 image.lockFocus()
 let text=NSAttributedString(string:job["text"]!,attributes:[.font:NSFont(name:"Apple Color Emoji",size:130)!])
 let measured=text.size()
 text.draw(at:NSPoint(x:(160-measured.width)/2,y:(160-measured.height)/2))
 image.unlockFocus()
 let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
 try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:target))
}
