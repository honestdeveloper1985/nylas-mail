Utils = require '../src/flux/models/utils'

describe "quoted text", ->
    it "should be correct for a google calendar invite", ->
        body = """<div style=""><table cellspacing="0" cellpadding="8" border="0" summary="" style="width:100%;font-family:Arial,Sans-serif;border:1px Solid #ccc;border-width:1px 2px 2px 1px;background-color:#fff;" itemscope itemtype="http://schema.org/Event"><tr><td><meta itemprop="eventStatus" content="http://schema.org/EventScheduled"/><div style="padding:2px"><span itemprop="publisher" itemscope itemtype="http://schema.org/Organization"><meta itemprop="name" content="Google Calendar"/></span><meta itemprop="eventId/googleCalendar" content="l4qksjqm6v89mqfisq8ddhdvh4"/><div style="float:right;font-weight:bold;font-size:13px"> <a href="https://www.google.com/calendar/event?action=VIEW&amp;eid=bDRxa3NqcW02djg5b…c4ZTEwZDM2NzRjY2NkYzkyZDI0ZTQ3OWY5OA&amp;ctz=America/Los_Angeles&amp;hl=en" style="color:#20c;white-space:nowrap" itemprop="url">more details &raquo;</a><br></div><h3 style="padding:0 0 6px 0;margin:0;font-family:Arial,Sans-serif;font-size:16px;font-weight:bold;color:#222"><span itemprop="name">Recruiting Email Weekly Blastoff</span></h3><div style="padding-bottom:15px;font-size:13px;color:#222;white-space:pre-wrap!important;white-space:-moz-pre-wrap!important;white-space:-pre-wrap!important;white-space:-o-pre-wrap!important;white-space:pre;word-wrap:break-word">Turn those cold leads into phone screens! You can make this go super fast by queueing up your drafts before hand and just sending them out during this time. </div><table cellpadding="0" cellspacing="0" border="0" summary="Event details"><tr><td style="padding:0 1em 10px 0;font-family:Arial,Sans-serif;font-size:13px;color:#888;white-space:nowrap" valign="top"><div><i style="font-style:normal">When</i></div></td><td style="padding-bottom:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222" valign="top"><time itemprop="startDate" datetime="20150228T010000Z"></time><time itemprop="endDate" datetime="20150228T013000Z"></time>Fri Feb 27, 2015 5pm &ndash; 5:30pm <span style="color:#888">Pacific Time</span></td></tr><tr><td style="padding:0 1em 10px 0;font-family:Arial,Sans-serif;font-size:13px;color:#888;white-space:nowrap" valign="top"><div><i style="font-style:normal">Calendar</i></div></td><td style="padding-bottom:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222" valign="top">Ben Gotow</td></tr><tr><td style="padding:0 1em 10px 0;font-family:Arial,Sans-serif;font-size:13px;color:#888;white-space:nowrap" valign="top"><div><i style="font-style:normal">Who</i></div></td><td style="padding-bottom:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222" valign="top"><table cellspacing="0" cellpadding="0"><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Michael Grinich</span><meta itemprop="email" content="mg@nilas.com"/></span><span style="font-size:11px;color:#888"> - organizer</span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Kartik Talwar</span><meta itemprop="email" content="kartik@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">team</span><meta itemprop="email" content="team@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Rob McQueen</span><meta itemprop="email" content="rob@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Evan Morikawa</span><meta itemprop="email" content="evan@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Christine Spang</span><meta itemprop="email" content="spang@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Karim Hamidou</span><meta itemprop="email" content="karim@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">nilas.com@allusers.d.calendar.google.com</span><meta itemprop="email" content="nilas.com@allusers.d.calendar.google.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Makala Keys</span><meta itemprop="email" content="makala@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Eben Freeman</span><meta itemprop="email" content="eben@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Jennie Lees</span><meta itemprop="email" content="jennie@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Ben Gotow</span><meta itemprop="email" content="ben@nilas.com"/></span></div></div></td></tr><tr><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><span style="font-family:Courier New,monospace">&#x2022;</span></td><td style="padding-right:10px;font-family:Arial,Sans-serif;font-size:13px;color:#222"><div><div style="margin:0 0 0.3em 0"><span itemprop="attendee" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Kavya Joshi</span><meta itemprop="email" content="kavya@nilas.com"/></span></div></div></td></tr></table></td></tr></table></div><p style="color:#222;font-size:13px;margin:0"><span style="color:#888">Going?&nbsp;&nbsp;&nbsp;</span><wbr><strong><span itemprop="action" itemscope itemtype="http://schema.org/RsvpAction"><meta itemprop="attendance" content="http://schema.org/RsvpAttendance/Yes"/><span itemprop="handler" itemscope itemtype="http://schema.org/HttpActionHandler"><link itemprop="method" href="http://schema.org/HttpRequestMethod/GET"/><a href="https://www.google.com/calendar/event?action=RESPOND&amp;eid=bDRxa3NqcW02dj…c4ZTEwZDM2NzRjY2NkYzkyZDI0ZTQ3OWY5OA&amp;ctz=America/Los_Angeles&amp;hl=en" style="color:#20c;white-space:nowrap" itemprop="url">Yes</a></span></span><span style="margin:0 0.4em;font-weight:normal"> - </span><span itemprop="action" itemscope itemtype="http://schema.org/RsvpAction"><meta itemprop="attendance" content="http://schema.org/RsvpAttendance/Maybe"/><span itemprop="handler" itemscope itemtype="http://schema.org/HttpActionHandler"><link itemprop="method" href="http://schema.org/HttpRequestMethod/GET"/><a href="https://www.google.com/calendar/event?action=RESPOND&amp;eid=bDRxa3NqcW02dj…c4ZTEwZDM2NzRjY2NkYzkyZDI0ZTQ3OWY5OA&amp;ctz=America/Los_Angeles&amp;hl=en" style="color:#20c;white-space:nowrap" itemprop="url">Maybe</a></span></span><span style="margin:0 0.4em;font-weight:normal"> - </span><span itemprop="action" itemscope itemtype="http://schema.org/RsvpAction"><meta itemprop="attendance" content="http://schema.org/RsvpAttendance/No"/><span itemprop="handler" itemscope itemtype="http://schema.org/HttpActionHandler"><link itemprop="method" href="http://schema.org/HttpRequestMethod/GET"/><a href="https://www.google.com/calendar/event?action=RESPOND&amp;eid=bDRxa3NqcW02dj…c4ZTEwZDM2NzRjY2NkYzkyZDI0ZTQ3OWY5OA&amp;ctz=America/Los_Angeles&amp;hl=en" style="color:#20c;white-space:nowrap" itemprop="url">No</a></span></span></strong>&nbsp;&nbsp;&nbsp;&nbsp;<wbr><a href="https://www.google.com/calendar/event?action=VIEW&amp;eid=bDRxa3NqcW02djg5b…c4ZTEwZDM2NzRjY2NkYzkyZDI0ZTQ3OWY5OA&amp;ctz=America/Los_Angeles&amp;hl=en" style="color:#20c;white-space:nowrap" itemprop="url">more options &raquo;</a></p></td></tr><tr><td style="background-color:#f6f6f6;color:#888;border-top:1px Solid #ccc;font-family:Arial,Sans-serif;font-size:11px"><p>Invitation from <a href="https://www.google.com/calendar/" target="_blank" style="">Google Calendar</a></p><p>You are receiving this email at the account ben@nilas.com because you are subscribed for invitations on calendar Ben Gotow.</p><p>To stop receiving these emails, please log in to https://www.google.com/calendar/ and change your notification settings for this calendar.</p></td></tr></table></div>"""
        expect(Utils.containsQuotedText(body)).toBe(false)

    it "should be correct when email contains <p> tags", ->
        body = """<p>Hi Ben</p>
    <p>Please goto the Workspaces Console &gt; Directories.</p>
    <p>Then, select the Directory and "Deregister".&amp;nbsp; After you deregister the Directory from Workspaces, you should then be able to goto Directory Services and remove the Directory.</p>
    <p>Ben</p>"""
        expect(Utils.containsQuotedText(body)).toBe(false)
        expect(Utils.withoutQuotedText(body)).toBe(body)

describe "subjectWithPrefix", ->
    it "should replace an existing Re:", ->
        expect(Utils.subjectWithPrefix("Re: Test Case", "Fwd:")).toEqual("Fwd: Test Case")

    it "should replace an existing re:", ->
        expect(Utils.subjectWithPrefix("re: Test Case", "Fwd:")).toEqual("Fwd: Test Case")

    it "should replace an existing Fwd:", ->
        expect(Utils.subjectWithPrefix("Fwd: Test Case", "Re:")).toEqual("Re: Test Case")

    it "should replace an existing fwd:", ->
        expect(Utils.subjectWithPrefix("fwd: Test Case", "Re:")).toEqual("Re: Test Case")

    it "should not replace Re: or Fwd: found embedded in the subject", ->
        expect(Utils.subjectWithPrefix("My questions are: 123", "Fwd:")).toEqual("Fwd: My questions are: 123")
        expect(Utils.subjectWithPrefix("My questions fwd: 123", "Fwd:")).toEqual("Fwd: My questions fwd: 123")

    it "should work if no existing prefix is present", ->
        expect(Utils.subjectWithPrefix("My questions", "Fwd:")).toEqual("Fwd: My questions")
