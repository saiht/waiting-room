-- Ouvre un panneau à droite de la session iTerm donnée et y lance une commande.
-- Usage : osascript iterm-split.applescript <id-de-session> <commande>
on run argv
	set sid to item 1 of argv
	set cmd to item 2 of argv
	tell application "iTerm2"
		repeat with w in windows
			repeat with t in tabs of w
				repeat with s in sessions of t
					if (id of s as text) is sid then
						tell s
							set gamePane to (split vertically with default profile command cmd)
						end tell
						tell gamePane to select
						return
					end if
				end repeat
			end repeat
		end repeat
		-- Session introuvable : on se rabat sur le panneau actif.
		tell current session of current window
			set gamePane to (split vertically with default profile command cmd)
		end tell
		tell gamePane to select
	end tell
end run
