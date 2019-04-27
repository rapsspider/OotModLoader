require("OotUtils")

local save_context = 0x11A5D0

local scene_offset = 0x00D4
local scene_size = 0x0B0C

local skulltula_flags_offset = 0x0E9C
local skulltula_flags_size = 0x18

local event_flags_offset = 0x0ED4
local event_flags_size = 0x1C

local inf_table_offset = 0x0EF8
local inf_table_size = 0x3C

local dungeon_items_offset = 0x00A8
local dungeon_item_bytes = 0x14

local count = 0;
function writeAllFlags(offset, size)
    for i = 0, size, 1 do
        local addr = save_context + offset + i;
        writeByte(addr, 0xFF);
        count = count + 1;
    end
end

writeAllFlags(scene_offset, scene_size)

writeAllFlags(skulltula_flags_offset, skulltula_flags_size)

writeAllFlags(event_flags_offset, event_flags_size)

writeAllFlags(inf_table_offset, inf_table_size)

writeAllFlags(dungeon_items_offset, dungeon_item_bytes)

console.log("Wrote " .. tostring(count) .. " bytes.");

while true do
    emu.frameadvance()
end